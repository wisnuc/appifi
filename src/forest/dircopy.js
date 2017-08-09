const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const child = require('child_process')
const debug = require('debug')('dircopy')

const { forceXstat } = require('../lib/xstat')

const fileCopy = require('./filecopy')

class Transform extends EventEmitter {

  constructor (options) {
    super()
    this.concurrency = 1 

    Object.assign(this, options)

    this.pending = []
    this.working = []
    this.finished = []
    this.failed = []

    this.prev = null
    this.next = null
  } 

  push (x) {
    this.pending.push(x)
    this.schedule()
  }

  pull() {
    let xs = this.finished
    this.finished = [] 
    this.schedule()
    return xs
  }

  isBlocked () {
    return !!this.failed.length
      || !!this.finished.length
      || (this.next ? this.next.isBlocked() : false)
  }

  isRunning () {
    return !this.isStopped()
  }

  isStopped () {
    return !this.working.length 
      && (this.next ? this.next.isStopped() : true)
  }

  isSelfStopped () {
    return !this.working.length
  }

  head () {
    return this.prev === null
      ? this
      : this.prev.head()
  }

  pipe (next) {
    this.next = next
    next.prev = this
    return next
  }

  print() {
    debug(this.name, 
      this.pending.map(x => x.name),
      this.working.map(x => x.name), 
      this.finished.map(x => x.name), 
      this.failed.map(x => x.name),
      this.isStopped(),
    )
    if (this.next) this.next.print()
  }

  schedule () {
    // stop working if blocked
    if (this.isBlocked()) return 

    // pull prev
    if (this.prev) {
      this.pending = [...this.pending, ...this.prev.pull()]
    }

    while (this.working.length < this.concurrency && this.pending.length) {
      let x = this.pending.shift() 
      this.working.push(x)
      this.transform(x, (err, y) => {
        this.working.splice(this.working.indexOf(x), 1)
        if (err) {
          x.error = err
          this.failed.push(x)
        } else {
          if (this.next) {
            this.next.push(y)
          } else {
            if (this.head().listenerCount('data')) {
              this.head().emit('data', y)
            } else {
              this.finished.push(y)
            }
          }
        }

        this.schedule()
        this.head().emit('step', this.name, x.name)
      })
    }
  }
}

class DirCopy extends EventEmitter {
 
  constructor (src, tmp, files, getDirPath) {
    super()

    let dst = getDirPath()
    let pipe = new Transform({ 
      name: 'copy',
      concurrency: 4,
      transform: (x, callback) => 
        x.worker = fileCopy(path.join(src, x.name), path.join(tmp, x.name), 
          (err, fingerprint) => {
            delete x.worker
            return err ? callback(err) : callback(null, (x.fingerprint = fingerprint, x))
          })
    }).pipe(new Transform({ 
      name: 'stamp',
      transform: (x, callback) =>
        forceXstat(path.join(tmp, x.name), { hash: x.fingerprint }, 
          (err, xstat) => err 
            ? callback(err) 
            : callback(null, (x.uuid = xstat.uuid, x)))
    })).pipe(new Transform({ 
      name: 'move',
      transform: (x, callback) =>
        fs.link(path.join(tmp, x.name), path.join(dst, x.name), err => err
          ? callback(err) 
          : callback(null, x))
    })).head()

    let count = 0
    pipe.on('data', data => this.emit('data', data))
    pipe.on('step', (tname, xname) => {
      console.log('------------------------------------------')
      console.log(`step ${count++}`, tname, xname)
      pipe.print()
      if (pipe.isStopped()) this.emit('stopped')
    })

    files.forEach(name => pipe.push({ name }))
    // pipe.push({ name: files[0] })
    // pipe.push({ name: files[1] })
    pipe.print()
    this.pipe = pipe
  } 
}

module.exports = DirCopy

