const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const debug = require('debug')('readdir1')

// This stepper requires a root dir (root)
// push x, x is a path relative to src
// emit data, { path: relative path, files: [] array of file names }
module.exports = class extends EventEmitter {

  constructor (root) {
    super()
    this.root = root
    this.pending = []
    this.working = []
    this.finished = []
    this.failed = []
  }

  push (x) {
    debug('push', x)
    this.pending.push({ path: x })
    this.schedule()
  }

  pull (size) {
  
  }

  isStopped () {
    return !this.working.length && !this.pending.length
  }

  schedule () {
    if (this.working.length) return
    if (!this.pending.length) return

    let x = this.pending.shift()
    this.working.push(x)
    let dir = path.join(this.root, x.path)
    fs.readdir(dir, (err, entries) => {
      if (err || entries.length === 0) {
        this.working = []

        if (err) {
          x.error = err
          this.failed.push(x)
          this.emit('error', err)
        } else {
          this.emit('data', Object.assign(x, { files: [] }))
        }

        this.schedule()
      } else {
        let count = entries.length
        let files = []
        entries.forEach(entry => {
          let entryPath = path.join(x.path, entry)
          fs.lstat(path.join(this.root, entryPath), (err, stat) => {
            if (!err) {
              if (stat.isDirectory()) {
                this.push(entryPath)
              } else if (stat.isFile()) {
                files.push(entry)
              }
            }

            if (!--count) {
              this.working = []
              this.emit('data', Object.assign(x, { files }))
              this.schedule()
            }

            this.emit('step')
          })
        })
      }

      this.emit('step')
    })
  }

}
