const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const rimraf = require('rimraf')

const { forceXstat } = require('../lib/xstat')
const Transform = require('../lib/transform')
const fileCopy = require('../forest/filecopy')
// const DirCopy = require('./dircopy')
// const DirWalk = require('./dirWalker')
const Forest = require('../forest/forest')

class DirCopy2 extends EventEmitter {

  constructor(options) {
    super()
    this.concurrency = 1

    Object.assign(this, options)

    this.pending = []
    this.working = []
    this.finished = []
    this.failed = []

    this.ins = []
    this.outs = []
  } 

  // x { path, files }
  push(x) {
    this.pending.push(x) 
    this.schedule()
  }

  isStopped() {
    return !this.working.length && !this.pending.length
  } 

  schedule() {
    // if (this.isBlocked()) return

    while (this.working.length < this.concurrency && this.pending.length) {
      let y = this.pending.shift()
      this.working.push(y)

      let src = path.join(this.src, y.path)
      let tmp = path.join(this.tmp, y.path)
      let dst = path.join(this.dst, y.path)

      let pipe = new Transform([{
        name: 'copy',
        concurrency: 4,
        push: function (x) {
          x.files.forEach(name => this.pending.push({ name }))  
          this.schedule()
        },
        transform: (x, callback) =>
          (x.abort = fileCopy(path.join(src, x.name), path.join(tmp, x.name),
            (err, fingerprint) => {
              delete x.abort
              if (err) {
                callback(err)
              } else {
                callback(null, (x.fingerprint = fingerprint, x))
              }
            }))
      }, {
        name: 'stamp',
        transform: (x, callback) =>
          forceXstat(path.join(tmp, x.name), { hash: x.fingerprint },
            (err, xstat) => {
              if (err) {
                callback(err)
              } else {
                callback(null, (x.uuid = xstat.uuid, x))
              }
            })
      }, {
        name: 'move',
        transform: (x, callback) =>
          fs.link(path.join(tmp, x.name), path.join(dst, x.name), err => err
            ? callback(err)
            : callback(null, x))
      }, {
        name: 'remove',
        transform: (x, callback) => rimraf(path.join(tmp, x.name), () => callback(null, x))
      }])


      // drain data
      pipe.on('data', data => console.log('pipe drain', data))
      pipe.on('step', () => {

        pipe.print()

        if (pipe.isStopped()) {
          this.working.splice(this.working.indexOf(y), 1)
          if (pipe.isFinished()) {
            // drop x and pipe (todo)  
          } else {
            this.failed.push(y)
          }
          this.schedule()
        }

        this.emit('step')
      })

      // y.files.forEach(name => pipe.push({ name })) 
      pipe.push(y)
      y.pipe = pipe
    } 
  }
}

class DirCopy extends EventEmitter {

  constructor(options) {
    super()
    this.concurrency = 1

    Object.assign(this, options)

    this.pending = []
    this.working = []
    this.finished = []
    this.failed = []

    this.ins = []
    this.outs = []
  } 

  // x { path, files }
  push(x) {
    this.pending.push(x) 
    this.schedule()
  }

  isStopped() {
    return !this.working.length && !this.pending.length
  } 

  schedule() {
    // if (this.isBlocked()) return

    while (this.working.length < this.concurrency && this.pending.length) {
      let y = this.pending.shift()
      this.working.push(y)

      let src = path.join(this.src, y.path)
      let tmp = path.join(this.tmp, y.path)
      let dst = path.join(this.dst, y.path)

      let pipe = new Transform([{
        name: 'copy',
        concurrency: 4,
        transform: (x, callback) =>
          (x.abort = fileCopy(path.join(src, x.name), path.join(tmp, x.name),
            (err, fingerprint) => {
              delete x.abort
              if (err) {
                callback(err)
              } else {
                callback(null, (x.fingerprint = fingerprint, x))
              }
            }))
      }, {
        name: 'stamp',
        transform: (x, callback) =>
          forceXstat(path.join(tmp, x.name), { hash: x.fingerprint },
            (err, xstat) => {
              if (err) {
                callback(err)
              } else {
                callback(null, (x.uuid = xstat.uuid, x))
              }
            })
      }, {
        name: 'move',
        transform: (x, callback) =>
          fs.link(path.join(tmp, x.name), path.join(dst, x.name), err => err
            ? callback(err)
            : callback(null, x))
      }, {
        name: 'remove',
        transform: (x, callback) => rimraf(path.join(tmp, x.name), () => callback(null, x))
      }])


      // drain data
      pipe.on('data', data => console.log('pipe drain', data))
      pipe.on('step', () => {

        pipe.print()

        if (pipe.isStopped()) {
          this.working.splice(this.working.indexOf(y), 1)
          if (pipe.isFinished()) {
            // drop x and pipe (todo)  
          } else {
            this.failed.push(y)
          }
          this.schedule()
        }

        this.emit('step')
      })

      y.files.forEach(name => pipe.push({ name })) 
      y.pipe = pipe
    } 
  }
}

class DirImport extends EventEmitter {

  constructor (options) {
    super()

    Object.assign(this, options)

    this.pending = []
    this.working = []
    this.failed = []
    this.finished = []

    this.dirwalk = new Transform({
      spawn: {
        src: this.src,
        transform: function (y, callback) {
          fs.readdir(path.join(this.src, y.path), (err, entries) => {
            if (err || entries.length === 0) {
              if (err) {
                y.error = err
                callback(err)
              } else {
                callback(null, { path: y.path, files: [] })
              }
            } else {
              let count = entries.length
              let files = []
              entries.forEach(entry => {
                fs.lstat(path.join(this.src, y.path, entry), (err, stat) => {
                  if (err) {
                    // TODO
                  } else {
                    if (stat.isDirectory()) {
                      this.unshift({ path: path.join(y.path, entry) })
                    } else if (stat.isFile()) {
                      files.push(entry)
                    } else {
                      
                    }
                  } 

                  if (!--count) callback(null, { path: y.path, files })
                })  
              })
            }
          })
        } 
      }
    })

    this.dirwalk.on('data', data => {
      console.log('====')  
      console.log(data)
      console.log('====')
    })

    this.dirwalk.push({ path: 'foobar' })

    // create dircopy sink
    this.dircopy = new DirCopy({ 
      src: this.src, 
      tmp: this.tmp,
      dst: this.dst
    })

    let count = this.files.length
    let dirs = []
    let files = []
    this.files.forEach(name => fs.lstat(path.join(this.src, name), (err, stat) => {
      if (err) {
        // TODO
      } else {
        if (stat.isDirectory()) {
          dirs.push({ name })
        } else if (stat.isFile()) {
          files.push(name)
        } else {
          // TODO
        }
      }

      if (!--count) {
        this.dircopy.push({ path: '', files })
      }
    }))

    this.dircopy.on('step', () => {
      if (this.dircopy.isStopped()) {
        this.emit('stopped')
      }
    })
  } 

}

module.exports = DirImport

