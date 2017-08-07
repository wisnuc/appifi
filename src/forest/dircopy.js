const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const child = require('child_process')
const debug = require('debug')('dircopy')

const { forceXstat } = require('../lib/xstat')

const fileCopy = require('./filecopy')

//
// definition of x { name }
//
class Copy extends EventEmitter {

  constructor (src, dst, concurrency) {
    super()
    this.concurrency = concurrency || 2
    this.pending = []
    this.working = []
    this.failed = []

    this.src = src
    this.dst = dst
  }

  push (x) {
    this.pending.push(x)
    this.schedule()
  }

  isStopped () {
    return this.pending.length === 0 && this.working.length === 0
  }

  schedule () {

    console.log('before copy schedule', this.pending.map(x => x.name), 
      this.working.map(x => x.name))

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

            console.log(':: done', x.name)

            // schedule
            this.schedule()

            // emit stopped
            this.emit('done', x.name)
          })

        this.working.push(x)
      })

    this.pending = this.pending.slice(diff)

    console.log('after copy schedule', this.pending.map(x => x.name), 
      this.working.map(x => x.name))
  }
}

//
// definition of x { name, fingerprint }, no limit
// 
class Stamp extends EventEmitter {

  constructor (dir) {
    super()
    this.pending = []
    this.working = []
    this.failed = []
    this.dir = dir
  }

  isStopped () {
    return !this.pending.length && !this.working.length
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

      this.emit('done', x.name)
    }) 
  }
}

// 
// definition of x { name }, no limit
// 
class Move extends EventEmitter {

  constructor (src, dst) {
    super()
    this.pending = []
    this.working = []
    this.failed = []
    this.src = src
    this.dst = dst
  }

  isStopped () {
    return !this.pending.length && !this.working.length
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

      this.emit('done', x.name)
    }) 
  }
}

class DirCopy extends EventEmitter {

  constructor (src, dst, files, getDirPath) {
    super()
    this.src = src
    this.dst = dst
    this.getDirPath = getDirPath

    const done = () => {

//      this.snapshot('copy')
//      this.snapshot('stamp')
//      this.snapshot('move')

      if (this.copy.isStopped() && this.stamp.isStopped() && this.move.isStopped())
        this.emit('stopped')
    }

    this.copy = new Copy(src, dst)
    this.stamp = new Stamp(dst)
    this.move = new Move(dst, getDirPath())

    this.copy.on('data', x => {
      this.stamp.push(x)
    })
    this.copy.on('done', x => {
      //console.log('copy done', x) 
      //this.snapshot('copy')
    })
    this.stamp.on('data', x => this.move.push(x))    
    this.stamp.on('done', done)
    this.move.on('data', x => {})
    this.move.on('done', done)

    files.forEach(file => this.copy.push({ name: file }))

    
  }

  

  isStopped () {
    console.log('>>>>>>')
    this.snapshot('copy')
    this.snapshot('stamp')
    this.snapshot('move')
    console.log('<<<<<<')
    return this.copy.isStopped() && this.stamp.isStopped() && this.move.isStopped()
  }

  snapshot (name) {
    console.log(name, this[name].pending.map(x => x.name), this[name].working.map(x => x.name))
  }
}

module.exports = DirCopy

