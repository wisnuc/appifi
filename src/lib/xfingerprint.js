const fs = require('fs')
const EventEmitter = require('events')
const { updateFileHash } = require('./xstat')
const Fingerprint = require('./fingerprint2')

// xfingerprint encapsulates fingerprint and requires uuid
class XFingerprint extends EventEmitter {

  constructor(filePath, uuid) {
    super()
    this.fp = null
    this.destroyed = false

    fs.lstat(filePath, (err, stat) => {
      if (this.destroyed) return
      if (err) {
        this.destroy()
        this.emit('error', err)
      } else if (!stat.isFile()) {
        this.destroy()
        this.emit('error', new Error('not a file'))
      } else {
        this.fp = new Fingerprint(filePath)
        this.fp.on('error', err => {
          this.destroy()
          this.emit('error', err)
        })

        this.fp.on('data', fingerprint => {
          this.fp = null
          fs.lstat(filePath, (err, stat2) => {
            if (this.destroyed) return
            if (!stat2.isFile()) {
              this.emit('error', new Error('not a file'))
            } else if (stat.mtime.getTime() !== stat2.mtime.getTime()) {
              this.emit('error', new Error('race detected'))
            } else {
              updateFileHash(filePath, uuid, fingerprint, stat2.mtime.getTime(), (err, xstat) => {
                if (this.destroyed) return
                if (err) {
                  this.emit('error', err)
                } else {
                  this.emit('data', xstat) 
                }
              }) 
            }
          })
        })
      } 
    }) 
  }

  destroy () {
    if (this.destroyed) return
    this.destroyed = true
    if (this.fp) {
      this.fp.removeAllListeners()
      this.fp.on('error', () => {})
      this.fp.destroy()
      this.fp = null
    }
  }
}

const xfingerprint = (filePath, uuid, callback) => {

  let fp = null
  let destroyed = false

  const destroy = () => {
    if (destroyed) return
    if (fp) {
      fp.removeAllListeners()
      fp.on('error', () => {})
      fp.destroy()
      fp = null
    }
  }

  fs.lstat(filePath, (err, stat) => {
    if (destroyed) return
    if (err) return callback(err)
    if (!stat.isFile()) return callback(new Error('not a file'))
    fp = new Fingerprint(filePath) 
    fp.on('error', err => (destroy(), callback(err)))
    fp.on('data', fingerprint => {
      fp = null
      updateFileHash(filePath, uuid, fingerprint, stat.mtime.getTime(), (err, xstat) => {
        if (destroyed) return
        callback(err, xstat)
      })
    })
  })

  return { destroy }
}

module.exports = xfingerprint 


