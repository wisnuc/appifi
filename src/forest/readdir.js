const debug = require('debug')('fruitmix:readdir')

const path = require('path')
const fs = require('fs')
const { readXstat } = require('../lib/xstat')
const Monitor = require('./monitor')

const xreaddir = require('./xreaddir')

/**
`readdir` reads the contents of directories and updates `Directory` children and mtime accordingly.

`readdir` is implemented in state machine pattern. There are three states defined:
+ Init
+ Idle
+ Pending
+ Working

@module readdir
*/

class Base {

  constructor (ctx, dir) {
    this.ctx = ctx
    this.dir = dir
    this.dir.readdir = this
  }

  exit () {
  }

  readi () {
    new Working(this.ctx, this.dir, [])
  }

  readn (delay) {
    new Pending(this.ctx, this.dir, delay)
  }

  readc (callback) {
    new Working(this.ctx, this.dir, [callback])
  }

  reading () {
    return false
  }

  restart () {
  }

  destroy () {
    this.exit()
  }

}

class Init extends Base {

  constructor (ctx, dir) {
    super(ctx, dir)
    this.ctx.dirInit.add(this.dir.uuid) 
  }
 
  exit () {
    this.ctx.dirInit.delete(this.dir.uuid)
    this.c
  } 
}

class Idle extends Base {

  constructor (ctx, dir) {
    super(ctx, dir)
  }

}

class Pending extends Base {

  constructor (dir, delay) {
    super(dir)
    this.ctx.dirPending.add(this.dir.uuid)
    this.readn(delay)
  }

  exit () {
    this.ctx.dirPending.delete(this.dir.uuid)
  }

  readn (delay) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.readi(), delay)
  }

  readc (callback) {
    clearTimeout(this.timer)
    new Working(this.dir, [callback]) 
  }

}

class Working extends Base {

  // callbacks may be an empty array
  constructor (dir, callbacks) {
    super(dir)
    this.callbacks = callbacks
    this.compareTimestamp = callbacks.length === 0

    /**
    `pending` queues all incoming read requests. 
    If all requests are delayed, `pending` is the minimum value. 
    Otherwise, it's an array (may be empty).
    @type {(number|Array|undefined)}
    */
    this.pending = undefined

    this.xread = null
    this.restart()
    this.ctx.dirReading.add(this.dir.uuid)
  }

  exit () {
    this.ctx.dirReading.delete(this.dir.uuid)
  }

  restart () {
    if (this.xread) this.xread.destroy()

    let dirPath = this.dir.abspath()
    let uuid = this.dir.uuid
    let _mtime = this.compareTimeStamp ? this.dir.mtime : null
    this.xread = xreaddir(dirPath, uuid, _mtime, (err, xstats, mtime, transient) => {

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

      this.callbacks.forEach(callback => callback(err, xstats))

      if (Array.isArray(this.pending)) {
        new Working(this.dir, this.pending)
      } else if (typeof this.pending === 'number') {
        new Pending(this.dir, this.pending)
      } else if (xstats && transient) {
        new Pending(this.dir, 500)
      } else {
        new Idle(this.dir)
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
    if (Array.isArray(this.pending)) return
    this.pending = []
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

  reading () {
    return true
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
Construct a `readdir` state machine, starting from `Working` state.

@param {Directory} dir - Directory object
*/
const readdir = (dir, done) => new Init(dir, done)

module.exports = readdir
