const path = require('path')
const fs = require('fs')
const xreaddir = require('./xreaddir')

/**
`readdir` reads the contents of directories and updates `Directory` children and mtime accordingly.

`readdir` is implemented in state machine pattern. There are three states defined:
+ Idle (also the base class)
+ Init (with or without a timer)
+ Pending
+ Reading

@module readdir
*/

class Idle {

  constructor (dir, ...args) {
    this.dir = dir
    this.dir.readdir = this
    this.enter(...args)
  }

  enter () {
  }

  exit () {
  }

  readi () {
    this.exit()
    new Reading(this.dir)
  }

  readn (delay) {
    this.exit()
    new Pending(this.dir, delay)
  }

  readc (callback) {
    this.exit()
    new Reading(this.dir, [callback])
  }

  restart () {
  }

  destroy () {
    this.exit()
  }

}


// init may be idle or pending
class Init extends Idle {

  enter () {
    this.timer = -1
    this.dir.ctx.dirEnterInit(this.dir)
  }

  exit () {
    clearTimeout(this.timer)
    this.dir.ctx.dirExitInit(this.dir)
  }

  readn (delay) {
    clearTimeout(this.timer) 
    this.timer = setTimeout(() => this.readi() , delay)
  }

}

class Pending extends Idle {

  enter (delay) {
    this.dir.ctx.dirEnterPending(this.dir)
    this.readn(delay)
  }

  exit () {
    clearTimeout(this.timer)
    this.dir.ctx.dirExitPending(this.dir)
  }

  readn (delay) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.readi(), delay)
  }

}

class Reading extends Idle {

  enter (callbacks = []) {
    this.callbacks = callbacks
    this.pending = undefined
    this.xread = null
    this.restart()
    this.dir.ctx.dirEnterReading(this.dir)
  }

  exit () {
    this.dir.ctx.dirExitReading(this.dir)
  }

  restart () {
    if (this.xread) this.xread.destroy()

    let dirPath = this.dir.abspath()
    let uuid = this.dir.uuid
    let _mtime = this.callbacks.length === 0 ? this.dir.mtime : null

    // console.log('xread', dirPath, uuid, _mtime)

    this.xread = xreaddir(dirPath, uuid, _mtime, (err, xstats, mtime, transient) => {

      // console.log('xreaddir done', this.dir.name, err, xstats, mtime, transient)

      if (dirPath !== this.dir.abspath()) {
        err = new Error('path changed during readdir operation')
        err.code = 'EINTERRUPTED'
      }

      if (err) {
        err.status = 503

        const pathErrCodes = ['ENOENT', 'ENOTDIR', 'EINSTANCE', 'EINTERRUPTED']
        if (pathErrCodes.includes(err.code)) {
          // this.fixPath()
          if (this.dir.parent) {
            this.dir.parent.read()
          } else {
            this.readn(1000)
          }
        } else {
          this.readn(1000)
        }
      } else if (xstats) {
        if (mtime !== this.dir.mtime) this.dir.merge(xstats)
        if (mtime !== this.dir.mtime && !transient) this.dir.mtime = mtime
        if (transient) this.readn(1000)
      }

      // console.log(xstats)

      this.callbacks.forEach(callback => callback(err, xstats))

      if (Array.isArray(this.pending)) { // stay in working
        this.enter(this.pending)
      } else {
        this.exit()
        if (typeof this.pending === 'number') {
          new Pending(this.dir, this.pending)
        } else if (xstats && transient) {
          new Pending(this.dir, 500)
        } else {
          new Idle(this.dir)
        }
      }
    }) 
  }

  /**
  Request immediate `read` on all ancestors along node path (exclusive).
  */
  fixPath () {
    // ancestors (exclusive)
    let ancestors = []
    for (let n = this.dir.parent; n !== null; n = n.parent) ancestors.unshift(n)
    ancestors.forEach(n => n.read())
  }

  readi () {
    if (!Array.isArray(this.pending)) this.pending = []
  }

  readn (delay) {
    if (Array.isArray(this.pending)) {
      return
    } else if (typeof this.pending === 'number') {
      this.pending = Math.min(this.pending, delay)
    } else {
      this.pending = delay
    }
  }

  readc (callback) {
    if (Array.isArray(this.pending)) {
      this.pending.push(callback)
    } else {
      this.pending = [callback]
    }
  }

  destroy () {
    let err = new Error('destroyed')
    err.code = 'EDESTROYED'
    this.callbacks.forEach(cb => cb(err))
    if (Array.isArray(this.pending)) this.pending.forEach(cb => cb(err))
    this.xread.destroy()
    super.destroy()
  }

}

/**
Construct a `readdir` state machine, starting from `Reading` state.

@param {Directory} dir - Directory object
*/
const readdir = dir => new Init(dir)

module.exports = readdir


