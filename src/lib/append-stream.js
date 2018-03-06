const path = require('path')
const fs = require('fs')
const child = require('child_process')
const stream = require('stream')
const debug = require('debug')('append')

const script = `

const fs = require('fs')
const hash = require('crypto').createHash('sha256')

if (process.argv.length !== 2) process.exit(1)

let start = parseInt(process.argv[1])
let totalRead = 0
let written = -1

const Loop = () => {
  // console.log('CHILD: creating readstream, start', start + totalRead)
  fs.createReadStream(null, { 
      fd: 4, 
      autoClose: false,
      start: start + totalRead,
      highWaterMark: 16 * 1024 * 1024 // default 64kb too small
    })
    .on('data', data => {
      hash.update(data)
      totalRead += data.length
      // console.log('CHILD: read', data.length, totalRead)
    })
    .on('end', () => written === totalRead 
      ? process.send(hash.digest('hex'), () => process.exit())
      : setImmediate(Loop))
}

process.on('message', message => {
  // console.log('CHILD: written', message)
  written = message
})

Loop()
`

/**

  1. fs.opening, w or w/o queue
  2. fs.fstat, w or w/o queue
  3. writestream | child

**/
class AppendStream extends stream.Writable {

  constructor(filePath) {
    super()

    this.pending = []
    this.working = []

    this.filePath = filePath
    fs.open(filePath, 'a+', (err, fd) => {
      if (err) return this.destroy(err)
      this.fd = fd
      fs.fstat(fd, (err, stat) => {
        if (err) this.destroy(err)
        this.stat = stat
        // -> writestream | child
        this.ws = fs.createWriteStream(null, { fd })
        this.ws.on('error', err => this.destroy(err))
        this.ws.on('finish', () => {
          debug('ws finish')
          this.ws.removeAllListeners()
          this.ws.on('error', () => {})
          this.bytesWritten = this.ws.bytesWritten
          this.ws = null
          this.child.send(this.bytesWritten)
        })

        const opts = { stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd] }
        this.child = child.spawn('node', ['-e', script, stat.size], opts)
        this.child.on('error', err => this.destroy(err))
        this.child.on('exit', (code, signal) => this.destroy())
        this.child.on('message', digest => {
          debug('child message', digest)
          this.child.removeAllListeners()
          this.child.on('error', () => {})
          this.digest = digest

          // the only one in working queue should be final cb 
          this.working.forEach(j => j.callback())
          this.working = []
        })

        this.schedule()
      }) 
    })
  }

  schedule() {
    while (this.ws && this.pending.length) {
      let j = this.pending.shift()
      if (j.chunk) {
        this.ws.write(j.chunk, j.encoding, () => this.working.length && this.working.shift().callback()) 
      } else {
        this.ws.end()
      }
      this.working.push(j)
    }
  }

  // push equivalent
  _write (chunk, encoding, callback) {
    debug('_write')
    if (this.destroyed) return callback() // TODO error ?
    this.pending.push({ chunk, encoding, callback })
    this.schedule()
  }

  // push equivalent
  _final (callback) {
    debug('_final')
    if (this.destroyed) return callback() // TODO error ?
    this.pending.push({ callback })
    this.schedule()
  }

  _destroy (err, callback) {
    debug('_destroy', err, callback)
    if (this.destroyed) return callback(err)
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws.destroy()
    }

    if (this.child) {
      this.child.removeAllListeners()
      this.child.on('error', () => {})
      this.child.kill()
    }

    [...this.working, ...this.pending].forEach(j => 
      j.callback(err || new Error('destroyed')))  // TODO not sure

    this.working = []
    this.pending = []
    callback(err)
  }

}

module.exports = AppendStream
