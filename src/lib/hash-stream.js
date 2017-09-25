const path = require('path')
const fs = require('fs')
const child = require('child_process')
const EventEmitter = require('events')
const debug = require('debug')('hash-stream')

const script = `

const fs = require('fs')
const hash = require('crypto').createHash('sha256')

let totalRead = 0
let written = -1

process.on('message', message => written = message)

const Loop = () => 
  fs.createReadStream(null, { fd: 4, autoClose: false, start: totalRead, highWaterMark: 16 * 1024 * 1024 })
    .on('data', data => (hash.update(data), totalRead += data.length))
    .on('end', () => written === totalRead 
      ? process.send(hash.digest('hex'), () => process.exit())
      : setImmediate(Loop))

Loop()
`

/**

  1. fs.opening, w or w/o queue
  2. fs.fstat, w or w/o queue
  3. writestream | child

**/
class HashStream extends EventEmitter {

  constructor(fd) {
    super()

    const opts = { stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd] }
    this.child = child.spawn('node', ['-e', script], opts)

    this.child.on('error', err => {
      this.child.removeAllListeners()
      this.child.kill()
      this.child = null
      this.emit(err)
    })

    this.child.on('exit', (code, signal) => {
      this.child.removeAllListeners()
      this.child = null
      if (code) {
        this.emit('error', new Error(`child exit code ${code}`))
      } else if (signal) {
        this.emit('error', new Error(`child exit signal ${signal}`))
      } else {
        this.emit('error', new Error(`child exit unexpectedly`))
      }
    })

    this.child.on('message', digest => {
      this.child.removeAllListeners()
      this.child.on('error', () => {})
      this.child = null
      this.digest = digest
      this.emit('data', digest)
    })

  }

  end (bytesWritten) {
    if (this.child) this.child.send(bytesWritten)
  }

  destroy () {
    if (this.child) this.child.kill()
  }
}

module.exports = HashStream
