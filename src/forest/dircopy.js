const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const child = require('child_process')
const debug = require('debug')('dircopy')

const { forceXstat } = require('../lib/xstat')

const fileCopy = require('./filecopy')

class Worker extends EventEmitter {

  constructor () {
    super()
    this.pending = []
    this.working = []
    this.failed = []
  }

  isStopped () {
    return !this.pending.legnth && !this.working.length
  }
}

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


//
// definition of x { name }
//
class Copy extends Worker {

  constructor (src, dst, concurrency) {
    super()
    this.concurrency = concurrency || 4
    this.src = src
    this.dst = dst
  }

  push (x) {
    this.pending.push(x)
    this.schedule()
  }

  schedule () {
    let diff = Math.min(this.concurrency - this.working.length, this.pending.length)
    this.pending.slice(0, diff)
      .forEach(x => {
        x.worker = fileCopy(path.join(this.src, x.name), path.join(this.dst, x.name),
          (err, fingerprint) => {
            // dequeue
            this.working.splice(this.working.indexOf(x), 1)
            delete x.worker

            if (err) {
              x.error = err
              this.failed.push(x)
              this.emit('error', err)
            } else {
              this.emit('data', x)
            }

            // schedule
            this.schedule()

            // emit stopped
            this.emit('step')
          })

        this.working.push(x)
      })

    this.pending = this.pending.slice(diff)
  }
}

//
// definition of x { name, fingerprint }, no limit
// 
class Stamp extends Worker {

  constructor (dir) {
    super()
    this.dir = dir
  }

  push (x) {
    this.working.push(x)
    forceXstat(path.join(this.dir, x.name), { hash: x.fingerprint }, (err, xstat) => {
      this.working.splice(this.working.indexOf(x), 1)

      if (err) {
        x.error = err
        this.failed.push(x)
        this.emit('error', err)
      } else {
        this.emit('data', x)
      }

      this.emit('step', x.name)
    }) 
  }
}

// 
// definition of x { name }, no limit
// 
class Move extends Worker {

  constructor (src, dst) {
    super()
    this.src = src
    this.dst = dst
  }

  push (x) {
    this.working.push(x)
    let src = path.join(this.src, x.name)
    let dst = path.join(this.dst, x.name)
    
    fs.link(src, dst, err => {
      this.working.splice(this.working.indexOf(x), 1)

      if (err) {
        x.error = err
        this.failed.push(x)
        this.emit('error', err)
      } else {
        this.emit('data', x)
      }

      this.emit('step', x.name)
    }) 
  }
}

class DirCopy extends EventEmitter {

  constructor (src, dst, files, getDirPath) {
    super()
    this.src = src
    this.dst = dst
    this.getDirPath = getDirPath

    const step = () => {
      if (this.copy.isStopped() && this.stamp.isStopped() && this.move.isStopped())
        this.emit('stopped')
    }

    this.copy = new Copy(src, dst)
    this.stamp = new Stamp(dst)
    this.move = new Move(dst, getDirPath())

    this.copy.on('data', x => this.stamp.push(x))
    this.copy.on('step', step)
    this.stamp.on('data', x => this.move.push(x))    
    this.stamp.on('step', step)
    this.move.on('data', x => {})
    this.move.on('step', step)

    files.forEach(file => this.copy.push({ name: file }))
  }

  isStopped() {
    return this.copy.isStopped() && this.stamp.isStopped() && this.move.isStopped()
  }

  isFailed() {
    return this.copy.failed.length || this.stamp.failed.length || this.move.failed.length
  }
}

class DirCopy2 extends EventEmitter {
 
  constructor (src, tmp, files, getDirPath) {
    super()

    let dst = getDirPath()

    let copy = new Transform({ 
      name: 'copy',
      concurrency: 4,
      transform: (x, callback) => 
        x.worker = fileCopy(path.join(src, x.name), path.join(tmp, x.name), 
          (err, fingerprint) => {
            delete x.worker
            return err ? callback(err) : callback(null, (x.fingerprint = fingerprint, x))
          })
    })

    let stamp = new Transform({ 
      name: 'stamp',
      transform: (x, callback) =>
        forceXstat(path.join(tmp, x.name), { hash: x.fingerprint }, 
          (err, xstat) => err 
            ? callback(err) 
            : callback(null, (x.uuid = xstat.uuid, x)))
    })

    let move = new Transform({ 
      name: 'move',
      transform: (x, callback) =>
        fs.link(path.join(tmp, x.name), path.join(dst, x.name), err => err
          ? callback(err) 
          : callback(null, x))
    })

    copy.pipe(stamp).pipe(move)

    let pipe = copy

    pipe.on('data', data => this.emit('data', data))
    pipe.on('step', (tname, xname) => {
      console.log('------------------------------------------')
      console.log('step', tname, xname)
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

module.exports = DirCopy2

