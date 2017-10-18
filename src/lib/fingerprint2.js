const fs = require('fs')
const EventEmitter = require('events')
const spawn = require('child_process').spawn
const crypto = require('crypto')

const script = `
const fs = require('fs')
const crypto = require('crypto')

const hashes = []
let hash = crypto.createHash('sha256')
let count = 0

const opts = { fd: 4, highWaterMark: 4 * 1024 * 1024 }
const ws = fs.createReadStream(null, opts) 
ws.on('error', () => { 
  ws.removeAllListeners()
  ws.on('error', () => {})
  process.exit(999)
})

ws.on('data', data => {
  if (data.length + count > (1024 * 1024 * 1024)) {
    hash.update(data.slice(0, (1024 * 1024 * 1024 - count)))
    hashes.push(hash.digest())
    hash = crypto.createHash('sha256')
    hash.update(data.slice((1024 * 1024 * 1024 - count)))
    count = data.length + count - 1024 * 1024 * 1024
  } else if (data.length + count === (1024 * 1024 * 1024)) {
    hash.update(data)
    hashes.push(hash.digest())
    hash = crypto.createHash('sha256')
    count = 0
  } else {
    hash.update(data) 
    count += data.length
  }
})

ws.on('end', () => {
  if (count) hashes.push(hash.digest())

  let fingerprint
  if (hashes.length === 0) {
    fingerprint = crypto.createHash('sha256').digest()
  } else {
    fingerprint = hashes.shift() 
    while (hashes.length)
      fingerprint = crypto
        .createHash('sha256')
        .update(Buffer.concat([fingerprint, hashes.shift()]))
        .digest()
  }

  process.send(fingerprint.toString('hex'))
})

`
const EMPTY_SHA256_HEX = crypto.createHash('sha256').digest('hex')

// explicit state: S => 0 
class Fingerprint extends EventEmitter {

  constructor (fpath) {
    super()
    this.child = null
    this.rs = null
    this.destroyed = false
    fs.open(fpath, 'r', (err, fd) => {
      if (this.destroyed) {
        if (!err) {
          fs.close(fd, () => {})
        }
      } else if (err) {
        this.emit('finish', err)
      } else {
        fs.fstat(fd, (err, stat) => {
          if (this.destroyed) {
            // close anyway
            fs.close(fd, () => {})
          } else if (err) {
            this.emit('finish', err)
          } else if (stat.size === 0) {
            fs.close(fd, () => {})
            this.fingerprint = EMPTY_SHA256_HEX
            this.emit('finish', null, this.fingerprint)
          } else if (stat.size <= 16 * 1024 * 1024) {
            let hash = crypto.createHash('sha256')
            this.rs = fs.createReadStream(null, { fd })
            this.rs.on('error', err => {
              this.destroy()
              this.emit('finish', err)
            })
            this.rs.on('data', data => hash.update(data))
            this.rs.on('end', () => {
              this.fingerprint = hash.digest('hex')
              this.emit('finish', null, this.fingerprint)
            })
          } else {
            const opts = { stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd] }
            this.child = spawn('node', ['-e', script], opts)
            this.child.on('error', err => {
              this.destroy()
              this.emit('finish', err)
            })
            this.child.on('message', message => {
              this.destroy()
              this.fingerprint = message
              this.emit('finish', null, this.fingerprint)
            })
            this.child.on('exit', (code, signal) => {
              this.destroy()
              this.emit('finish', new Error(`unexpected exit with code ${code}, signal ${signal}`))
            })
          }
        })
      }
    })
  }

  destroy () {
    if (this.destroyed) return
    this.destroyed = true

    if (this.child) {
      this.child.removeAllListeners()
      this.child.on('error', () => {})
      this.child.kill()
      this.child = null
    }

    if (this.rs) {
      this.rs.removeAllListeners()
      this.rs.on('error', () => {})
      this.rs.destroy()
      this.rs = null
    }
  }

}

module.exports = Fingerprint


