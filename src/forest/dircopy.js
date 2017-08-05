const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const child = require('child_process')

const { forceXstat } = require('./xstat')

class DirCopy extends EventEmitter {

  construct (src, dst, files, getTargetPath) {
    super()
    this.src = src
    this.dst = dst
    this.getTargetPath = getTargetPath
    this.concurrency = 2

    /** { name, error, worker } */
    this.q1 = files.map(name => ({ name }))

    /** { name, error } */
    this.q2 = []

    this.count = 0

    this.resume()
  }

  incWorker () {
    this.count++
  }

  decWorker () {
    process.nextTick(() => {
      this.count--
      if (this.isStopped()) this.emit('stop')
    })
  }

  isStopped () {
    return this.q1.every(x => x.error) && this.q2.every(x => x.error)
  }

  pause () {
    this.paused = true
  }

  resume () {
    this.paused = false
    this.copy()
    this.link()
  }

  copy () {
    while (true) {
      let xs = this.q1.filter(x => !x.worker && !x.error)
      if (xs.length === 0) return

      let x = xs[0]
      x.worker = fileImport(path.join(this.src, x.name), path.join(this.dst, x.name), err => {
        x.worker = null
        this.decWorker()
        if (err) {
          x.error = err.message
          this.copy()
        } else {
          // dequeue
          let index = this.q1.indexOf(x)
          this.q1.splice(index)
          this.copy()
          // enqueue
          this.q2.push(x.name)
          this.link()
        }
      })
      this.incWorker()
    }
  }

  link () {
    let xs = this.q2.filter(x => !x.error)
    if (xs.length === 0) return

    let x = xs[0]
    let dirPath = this.getTargetPath()
    fs.link(path.join(this.dst, x.name), path.join(dirPath, x.name), err => {
      x.worker = false
      if (err) {
        x.error = err.message
      } else {
        // dequeue
        let index = this.q2.indexOf(x)
        this.q2.splice(index)
      }
      this.link()
    })
    x.worker = true
    this.incWorker()
  }

}

module.exports = DirCopy
