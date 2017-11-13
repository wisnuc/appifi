const path = require('path')
const fs = require('fs')
const assert = require('assert')

const mkdirp = require('mkdirp')

const Node = require('./node')
const File = require('./file')
const readdir = require('./readdir')

const Debug = require('debug')
const debug = process.env.hasOwnProperty('DEBUG') ? Debug('directory') : () => {}

/**
Directory has four states:

+ Idle
+ Init (with or without a timer)
+ Pending
+ Reading

@module Directory
*/


class Base {

  constructor (dir, ...args) {
    this.dir = dir
    dir.state = this
    this.enter(...args)
  }

  enter () {
  }

  exit () {
  }

  setState (NextState, ...args) {
    this.exit()
    new NextState(this.dir, ...args)
  }

  readi () {
    this.setState(Reading)
  }

  readn (delay) {
    this.setState(Pending, delay)
  }

  readc (callback) {
    this.setState(Reading, [callback])
  }

  destroy () {
    this.exit()
  }

  namePathChanged () {
  }

}

// Do nothing, just for log
class Idle extends Base {

  enter () {
    this.dir.ctx.dirEnterIdle(this.dir)
  }

  exit () {
    this.dir.ctx.dirExitIdle(this.dir)
  }

}


// init may be idle or pending
class Init extends Base {

  enter () {
    this.dir.ctx.dirEnterInit(this.dir)
    this.timer = -1
  }

  exit () {
    clearTimeout(this.timer)
    this.dir.ctx.dirExitInit(this.dir)
  }

  readn (delay) {
    assert(Number.isInteger(delay) && delay > 0)

    clearTimeout(this.timer) 
    this.timer = setTimeout(() => this.readi(), delay)
  }

}

// 
class Pending extends Base {

  enter (delay) {
    assert(Number.isInteger(delay) && delay > 0)
    
    this.dir.ctx.dirEnterPending(this.dir)
    this.readn(delay)
  }

  exit () {
    clearTimeout(this.timer)
    this.dir.ctx.dirExitPending(this.dir)
  }

  readn (delay) {
    assert(Number.isInteger(delay) && delay > 0)

    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.readi(), delay)
  }

}

class Reading extends Base {

  enter (callbacks = []) {
    this.dir.ctx.dirEnterReading(this.dir)
    this.callbacks = callbacks
    this.pending = undefined
    this.readdir = null
    this.restart()
  }

  exit () {
    this.dir.ctx.dirExitReading(this.dir)
  }

  restart () {
    if (this.readdir) this.readdir.destroy()

    let dirPath = this.dir.abspath()
    let uuid = this.dir.uuid

    // when _mtime is null, read xstats forcefully
    let _mtime = this.callbacks.length === 0 ? this.dir.mtime : null

    debug('readdir', dirPath, uuid, _mtime)
    this.readdir = readdir(dirPath, uuid, _mtime, (err, xstats, mtime, transient) => {

      // change to debug
      debug('readdir done', err || xstats.length, mtime, transient)

      if (dirPath !== this.dir.abspath()) {
        err = new Error('path changed during readdir operation')
        err.code = 'EINTERRUPTED'
      }

      if (err) {
        err.status = 503
        const pathErrCodes = ['ENOENT', 'ENOTDIR', 'EINSTANCE', 'EINTERRUPTED']
        if (pathErrCodes.includes(err.code)) {
          if (this.dir.parent) {
            this.dir.parent.read()
          } else {
            this.readn(1000)
          }
        } else {
          console.log('readdir error', err.message)
          this.readn(1000)
        }
      } else if (xstats) {
        /**
        Don't bypass update children! Do it anyway. Node.js fs timestamp resolution is not adequate.
        */
        this.updateChildren(xstats)

        if (mtime !== this.dir.mtime && !transient) {
          this.dir.mtime = mtime
        }

        if (transient) {
          console.log('readdir: transient state detected')
          this.readn(1000)
        }
      }

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

  updateChildren (xstats) {
    // remove non-interested files
    xstats = xstats.filter(x => x.type === 'directory' || (x.type === 'file' && typeof x.magic === 'string'))

    // convert to a map
    let map = new Map(xstats.map(x => [x.uuid, x]))

    // update found child, remove found out of map, then destroy lost
    let dup = Array.from(this.dir.children)
    let lost = dup.reduce((arr, child) => {
      let xstat = map.get(child.uuid)
      if (xstat) {
        if (child instanceof File) {
          if (child.magic === xstat.magic && child.name === xstat.name && child.hash === xstat.hash) {
            // skip
          } else {
            // file update is too complex when magic/name/hash changed
            child.destroy(true) 
            new File(this.dir.ctx, this.dir, xstat)
          }
        } else {
          if (child.name === xstat.name && child.mtime === xstat.mtime) {
            // don't return !
          } else {
            if (child.name !== xstat.name) {
              child.name = xstat.name   
              child.namePathChanged()
            }

            if (child.mtime !== xstat.mtime) {
              child.state.readi()
            }
          }
        }

        map.delete(child.uuid)
      } else {
        arr.push(child)
      }
      return arr
    }, [])

    lost.forEach(c => c.destroy(true))

    // create new 
    map.forEach(x => x.type === 'file' ? 
      new File(this.dir.ctx, this.dir, x) : 
      new Directory(this.dir.ctx, this.dir, x))
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

  namePathChanged () {
    this.restart()
  }

  destroy () {
    let err = new Error('destroyed')
    err.code = 'EDESTROYED'
    this.callbacks.forEach(cb => cb(err))
    if (Array.isArray(this.pending)) this.pending.forEach(cb => cb(err))
    this.readdir.destroy()
    super.destroy()
  }

}

/**
Directory represents a directory in the underlying file system.

In this version, `children` contains only sub directories and files with interested type (magic is string).

Another change is the `Directory` should NOT be directly updated. Instead, external components MUST call `read` method after a file system operation finished.
*/
class Directory extends Node {
 
  /**
  @param {Forest} ctx
  @param {Directory} parent - parent `Directory` object
  @param {xstat} xstat
  */ 
  constructor(ctx, parent, xstat) {
    super(ctx, parent, xstat)

    this.children = []
    this.uuid = xstat.uuid
    this.name = xstat.name 
    this.mtime = -xstat.mtime

    this.ctx.indexDirectory(this)
    new Init(this)
  }

  /**
  Destructor
  */
  destroy(detach) {
    debug('destroying', this.uuid, this.name, !!detach)

    // why this does not work ???
    // [...this.children].forEach(child => child.destroy()) 
    Array.from(this.children).forEach(c => c.destroy())
    this.state.destroy()
    this.ctx.unindexDirectory(this) 
    super.destroy(detach)

    debug('destroyed', this.uuid, this.name, !!detach)
  }

  namePathChanged () {
    debug('namePathChanged', this.uuid, this.name)
    this.children.forEach(c => c.namePathChanged())
    this.state.namePathChanged()
  }

  /**
  Request a `state` operation. 

  @param {(function|number)} [x] - may be a callback function or a number
  */
  read(x) {
    if (typeof x === 'function') {
      this.state.readc(x)
    } else if (typeof x === 'number') {
      this.state.readn(x)
    } else {
      this.state.readi()
    }
  }

  readi () {
    this.state.readi()
  }

  readc (callback) {
    this.state.readc(callback)
  }

  readn (delay) {
    this.state.readn(delay)
  }

  /**
  Read xstats of the directory

  @returns {xstats[]}
  */
  async readdirAsync() {
    return new Promise((resolve, reject) => 
      this.readc((err, xstats) => err ? reject(err) : resolve(xstats)))
  }

  /**
  */
  nameWalk(names) {
    if (names.length === 0) return this
    let c = this.children.find(x => x instanceof Directory && x.name === names[0])
    if (!c) {
      return this
    } else {
      return c.nameWalk(names.slice(1))
    }
  }

}

Directory.Init = Init
Directory.Idle = Idle
Directory.Pending = Pending
Directory.Reading = Reading

module.exports = Directory







