const path = require('path')

const Node = require('./node')
const File = require('./file')
const Readdir = require('./readdir')

const mkdirp = require('mkdirp')
const { readXstat } = require('../lib/xstat')

const Debug = require('debug')


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

    // index
    // this.ctx.indexDirectory(this)
    this.ctx.onDirectoryCreated(this)
    this.ctx.indexDirectory(this)
  }

  /**
  Destructor
  */
  destroy() {
    [...this.children].forEach(child => child.destroy()) 
    this.readdir.abort()
    this.readdir = null
    // this.ctx.unindexDirectory(this) 
    this.ctx.onDirectoryDestroying(this)
    super.destroy()
  }

  /**
  Update children according to xstats returned from `read`.
  This is an internal function and is only called in `readdir`.
  @param {xstat[]} xstats
  @param {Monitor[]} monitors
  */
  merge(xstats) { 

    // remove non-interested files
    xstats = xstats.filter(x => x.type === 'directory' || 
      (x.type === 'file' && typeof x.magic === 'string'))

    // convert to a map
    let map = new Map(xstats.map(x => [x.uuid, x]))

    // update found child, remove found out of map, then destroy lost
    let lost = Array.from(this.children).reduce((arr, child) => {
      let xstat = map.get(child.uuid)
      if (xstat) {
        child.update(xstat) 
        map.delete(child.uuid)
      } else {
        arr.push(child)
      }
      return arr
    }, [])

    // remove lost
    lost.forEach(child => child.destroy())

    // new 
    map.forEach(val => {
      if (val.type === 'file') {
        new File(this.ctx, this, val)
      } else {
        new Directory(this.ctx, this, val)
      }
    })

  }

  /**
  Update this object with xstat props.
  This is an internal function and can only be called by `readdir`.
  Only `name` may be updated. `mtime` is updated by `readdir`. Either name or mtime change will trigger a `read`.
  @param {xstat} xstat - new `xstat`
  @param {Monitor[]} [monitors]
  */ 
  update(xstat) {
    // if nothing changed, return
    if (this.name === xstat.name && this.mtime === xstat.mtime) return

    // either name or timestamp changed, a read is required.
    if (this.name !== xstat.name) {
      this.name = xstat.name
      this.restart()
    } else {
      this.read()
    }
  }

  restart () {
    if (this.readdir) this.readdir.restart()
    this.children.forEach(c => c.restart())
  }

  /**
  Request a `readdir` operation. 

  @param {(function|number)} [x] - may be a callback function or a number
  */
  read(x) {
    if (typeof x === 'function') {
      this.readdir.readc(x)
    } else if (typeof x === 'number') {
      this.readdir.readn(x)
    } else {
      this.readdir.readi()
    }
  }

  /**
  Read xstats of the directory

  @returns {xstats[]}
  */
  async readdirAsync() {
    return await new Promise((resolve, reject) => 
      this.read((err, xstats) => err ? reject(err) : resolve(xstats)))
  }

  /**
  mkdirp and update children
  
  */
  mkdirp(name, parents, callback) {
    let dst = path.join(this.abspath(), name)     
    mkdirp(dst, err => {
      if (err) return callback(err)
      readXstat(dst, (err, xstat) => {
        if (!err && !this.children.find(x => x.uuid === xstat.uuid)) {
          new Directory(this.ctx, this, xstat)
          this.read(100)    
        }
        callback(err, xstat)
      })
    }) 
  }

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

module.exports = Directory



