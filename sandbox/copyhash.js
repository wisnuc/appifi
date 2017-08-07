const fs = require('fs')
const crypto = require('crypto')
const EventEmitter = require('events')

const SIZE1G = 1024 * 1024 * 1024

// duplicator emit finish, err XOR null
class Duplicator extends EventEmitter {

  constructor(src, dst) {
    super()
    this.defineError()
    this.fingerprint = undefined
    this.total = 0
    this.count = 0
    this.rs = fs.createReadStream(src)
    this.ws = fs.createWriteStream(dst)
    this.hash = this.newHash()
    this.rs.on('data', data => this.error || (this.update(data), this.ws.write(data)))
    this.rs.on('error', err => this.error = err)
    this.rs.on('end', () => this.error || (this.update(), this.ws.end()))
    this.ws.on('error', err => this.error = err)
    this.ws.on('finish', () => this.error || this.emit('finish'))
  }

  defineError() {
    Object.defineProperty(this, 'error', {
      get: function () {
        return this._error
      },
      set: function (x) {
        if (this._error) return
        this._error = x
        this.emit('finish', x)
        this.rs.destroy()
        this.ws.end()
      }
    })
  }

  newHash () {
    return crypto.createHash('sha256')
  }

  updateFingerprint () {
    if (this.fingerprint) {
      this.fingerprint = crypto.createHash('sha256').update(this.fingerprint).update(this.hash.digest()).digest()
    } else {
      this.fingerprint = this.hash.digest() 
    }
  }

  update(data) {
    if (data) {
      if (this.count + data.length < SIZE_1G) {
        this.hash.update(data)
        this.count += data.length
      } else {
        let delta = SIZE_1G - this.count
        this.hash.update(data.slice(0, delta))
        this.updateFingerprint()
        this.hash = this.newHash().update(data.slice(delta))
        this.count = data.length - delta 
      }

      this.total += data.length
    } else if (this.total === 0 || this.count !== 0) {
      this.updateFingerprint()
    }
  }
}

process.on('message', message => {
  let { src, dst } = message

  let fingerprint
  let total = 0
  let count = 0
  let hash = crypto.createHash('sha256')

  let rs = fs.createReadStream(src)
  let ws = fs.createWriteStream(dst)

  rs.on('data', data => {
    hash.update(data.slice(0, SIZE1G - count))
    count += data.length

    if (count >= SIZE1G) {
      count -= SIZE1G
      fingerprint = crypto.createHash('sha256').update(fingerprint).update(hash.digest()).digest()
      hash = crypto.createHash('sha256').update(data.slice(data.length - count))
    }

    total += data.length
    ws.write(data)    
  })
  
  rs.on('error', err => process.exit(1))
  rs.on('end', () => {
    if (total === 0 || count !== 0) { 
      fingerprint = crypto.createHash('sha256').update(fingerprint).update(hash.digest()).digest()
    }
    ws.end()
  })

  ws.on('error', err => process.exit(1))
  ws.on('close', () => {
    process.send(fingerprint.toString('hex'))
    process.exit(0)
  })
})





