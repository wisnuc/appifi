const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const child = require('child_process')
const stream = require('stream')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const debug = require('debug')('appendstream')

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
      process.send({ bytesRead: totalRead, digest: hash.digest('hex') })
      return process.exit(0)
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

const K = x => y => x

// child -> parent message
// number -> how many 

// this class extends writable stream, so it does NOT fire error or finish directly

const Mixin = base => class extends base {

  constructor(...args) {
    super(...args)
    this._untils = []
  }

  async until (predicate, ignore) {
    if (predicate()) return
    return new Promise((resolve, reject) => this._untils.push({ 
      predicate, 
      resolve, 
      reject: ignore ? null : reject
    }))
  }

  async untilAnyway (predicate) {
    if (predicate()) return
    return new Promise((resolve, reject) => this._untils.push({
      predicate,
      resolve
    }))
  }

  _until () {
    this._untils = this._untils.reduce((arr, x) => (this.error && x.reject) 
      ? K(arr)(x.reject(this.error))
      : x.predicate() 
        ? K(arr)(x.resolve()) 
        : [...arr, x], [])
  }

  observe (name, value) {
    let _name = '_' + name
    this[_name] = value
    Object.defineProperty(this, name, {
      get: function () {
        return this[_name]
      },
      set: function (x) { 
        if (this[_name]) return // TODO
        debug('observe set', name, x)
        this[_name] = x
        process.nextTick(() => this._until())
      }
    })
  }
}

class AppendStream extends Mixin(stream.Writable) {

  constructor(filePath) {
    super({ highWaterMark: 1024 * 1024 })

    this.observe('error', null)
    this.run(filePath)
      .then(() => {
        debug('run succeeded.')
      })
      .catch(e => {
        debug('run error')
        this.error = e
      })
      .then(() => {
        this.finalized = true
        debug('finalized')
      })
  }

  async run (filePath) {

    this.observe('tailReady')
    this.observe('ws')
    this.observe('wsFinished')
    this.observe('tailExited')
    this.observe('finalizing')
    this.observe('finalized')
  
    this.bytesWritten = 0

    this.tail = child.fork(modulePath)
    this.tail.on('message', message => {
      if (typeof message === 'object') {
        if (message.bytesRead === this.bytesWritten) {
          this.digest = message.digest
        } else {
          this.error = new Error('bytes written and read mismatch')
        }
      }
      else if (message === 'ready') {
        this.tailReady = true
      }
      else {
        this.error = new Error('invalid message from child process')
      }
    })
    this.tail.on('error', err => this.error = err)
    this.tail.on('exit', () => this.tailExited = true)
    this.tail.send({ filePath })

    await this.until(() => this.tailReady)

    this.ws = fs.createWriteStream(filePath, { flags: 'a'}) 
    this.ws.on('error', err => this.error = err)
    this.ws.on('finish', () => this.wsFinished = true)

    try {
      await this.until(() => this.finalizing)
      this.ws.end()
      await this.until(() => this.wsFinished)
      this.tail.send('final')
      await this.until(() => this.tailExited)
    } catch (e) {

      console.log('error caught', e, this.error)

      try {
        this.error = e
        this.ws.end()
        this.tail.kill()
      } catch (e) {
        console.log('failed again', e)
      }

      await this.untilAnyway(() => this.wsFinished && this.tailExited)
    }
  }

  _write(chunk, encoding, callback) {
    if (this.error) return callback(this.error)
    // TODO debug
    if (!this.ws) console.log('_write, waiting for write stream')
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

  _final(callback) {
    this.finalizing = true
    
    if (!this.finalized) console.log('_final, waiting for finalized')
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








