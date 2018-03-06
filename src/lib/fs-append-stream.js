const path = require('path')
const fs = require('fs')
const child = require('child_process')
const stream = require('stream')
const debug = require('debug')('appendstream')

const threadify = require('./threadify')

const modulePath = path.join('/tmp', '646af000-8406-4c7a-bfb9-7e83b8a20418')

const moduleSource = `

const fs = require('fs')
const crypto = require('crypto')
const hash = crypto.createHash('sha256')

let filePath, offset, fd
let length = 0
let totalRead = 0
let buffers = []
let stopped = false
let readFinished = false
let debug = false

// start: Object: { filePath, [debug] }
// number: new bytes written, that is, safe to read
// string: any string will terminate
process.on('message', message => {
  if (typeof message === 'object') {
    if (message.debug === true) debug = true
    if (debug) console.log('-> ', message)
    filePath = message.filePath
    fd = fs.openSync(filePath, 'a+') 
    offset = fs.fstatSync(fd).size
    // signal ready
    process.send('ready')
  } else if (typeof message === 'number') {
    length += message
  } else if (typeof message === 'string') {
    stopped = true
  } else {
    process.exit(1)
  }
})

// don't set position to null !!!
// fs.read(fd, buffer, offset, length, position, callback)

const readLoop = () => {
  if (length === 0) return setImmediate(readLoop)
  if (length === totalRead) {
    if (stopped) {
      readFinished = true
      return  // end loop
    } else {
      return setImmediate(readLoop) // next 
    }
  }

  let len = length - totalRead
  let buf = Buffer.allocUnsafe(length - totalRead)
  let pos = offset + totalRead
  fs.read(fd, buf, 0, len, pos, (err, bytesRead, buffer) => {
    if (err) process.exit(1)
    if (bytesRead !== 0) {
      totalRead += bytesRead
      buffers.push(buffer.slice(0, bytesRead))
    } else {
      // console.log('bytes read zero')
    }
    setImmediate(readLoop)
  })
}

const hashLoop = () => {
  if (buffers.length === 0) {
    if (readFinished) {
      // signal result and finish
      process.send({ bytesRead: totalRead, digest: hash.digest('hex') }, () => process.exit(0))
      // return process.exit(0)
    } 
  } else {
    if (debug) console.log(buffers.reduce((sum, buf) => sum + buf.length, 0))
    buffers.forEach(buf => hash.update(buf))
    buffers = []
  }
  setImmediate(hashLoop)
}

readLoop()
hashLoop()
`

fs.writeFileSync(modulePath, moduleSource)

// child -> parent message
// number -> how many

class AppendStream extends threadify(stream.Writable) {
  constructor (filePath) {
    super({ highWaterMark: 1024 * 1024 })

    this.defineSetOnce('error')
    this.defineSetOnce('tailReady')
    this.defineSetOnce('ws')
    this.defineSetOnce('wsFinished')
    this.defineSetOnce('tailExited')
    this.defineSetOnce('finalizing')
    this.defineSetOnce('finalized')

    this.bytesWritten = 0

    this.tail = child.fork(modulePath)
    this.tail.on('message', message => {
      if (typeof message === 'object') {

        debug('child object message', message)

        if (message.bytesRead === this.bytesWritten) {
          this.digest = message.digest
        } else {
          this.error = new Error('bytes written and read mismatch')
        }
      } else if (message === 'ready') {
        this.tailReady = true
      } else {
        this.error = new Error('invalid message from child process')
      }
    })
    this.tail.on('error', err => (this.error = err))
    this.tail.on('exit', () => (this.tailExited = true))
    this.tail.send({ filePath })

    this.run(filePath)
      .then(() => {})
      .catch(e => {
        this.error = e
        this.tail.kill()
        if (this.ws) this.ws.end()
      })

    this.untilAnyway(() => this.wsFinished && this.tailExited)
      .then(() => this.emit('finish'))
  }

  async run (filePath) {
    await this.until(() => this.tailReady)
    this.ws = fs.createWriteStream(filePath, { flags: 'a' })
    this.ws.on('error', err => (this.error = err))
    this.ws.on('finish', () => (this.wsFinished = true))

    await this.until(() => this.finalizing)
    this.ws.end()

    await this.until(() => this.wsFinished)
    this.tail.send('final')

    await this.until(() => this.tailExited) // to catch all possible errors
  }

  _write (chunk, encoding, callback) {
    if (this.error) return callback(this.error)
    if (!this.ws) debug('_write, waiting for write stream')
    this.until(() => !!this.ws)
      .then(() => this.ws.write(chunk, encoding, () => {
        this.bytesWritten += chunk.length
        this.tail.send(chunk.length)
        callback()
      }))
      .catch(e => callback(e))
  }

/**
  _writev(chunks, callback) {
    if (this.error) return callback(this.error)

    let totalLength = chunks.reduce((l, { chunk }) => l + chunk.length, 0)
    chunks.forEach(({chunk, encoding}, index) => {
      if (index === chunks.length - 1) { // last one
        this.ws.write(chunk, encoding, () => {
          if (this.error) return callback(this.error)
          this.bytesWritten += totalLength
          this.tail.send(totalLength)
          callback()
        })
      } else {
        this.ws.write(chunk, encoding)
      }
    })
  }
**/

  _final (callback) {
    this.finalizing = true
    if (!this.finalized) debug('_final, waiting for finalized')
    this.until(() => this.finalized)
      .then(() => callback(this.error))
  }
}

/**
mkdirp.sync('tmptest')

let as = new TailHash('tmptest/output')
as.on('finish', () => console.log('[as finish]', as.digest, as.bytesWritten))

fs.createReadStream('testdata/ubuntu.iso').pipe(as)
**/

// module.exports = AppendStream
module.exports = filePath => new AppendStream(filePath)
