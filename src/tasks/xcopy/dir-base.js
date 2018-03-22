const rimraf = require('rimraf')
const fs = require('fs')

const Node = require('./node')
const State = require('./state')

/**
`Pending` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Pending extends State {

  enter () {
    this.ctx.ctx.indexPendingDir(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexPendingDir(this.ctx)
  }

}

/**
`Working` state for directory sub-task

The destination directory (`dst`) should be created in this state.

@memberof XCopy.Dir
@extends XCopy.State
*/
class Working extends State {

  enter () {
    this.ctx.ctx.indexWorkingDir(this.ctx)

    let policy = this.ctx.getPolicy()
    let [same, diff] = policy
    if (same === 'keep') same = 'skip'
    this.mkdir([same, diff], (err, dst, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        // global keep, no conflict, resolved: [false, false], dirmove should finished
        let action = this.ctx.constructor.name
        let p = ['rename', 'replace']
        if ((policy[0] === 'skip' && resolved[0]) ||
        (policy[1] === 'skip' && resolved[1]) ||// for dir-copy diff skip
         (action === 'DirMove' && (!resolved[0] || p.includes(policy[0])))) { // in DirMove rename and replace move the whole directory once
          this.setState('Finished')
        } else {
          this.ctx.dst = dst
          this.setState('Reading')
        }
      }
    })
  }

  // abstract
  mkdir (policy, callback) {
    process.nextTick(() => callback(new Error('this function must be implemented by inherited class')))
  }

  exit () {
    this.ctx.ctx.unindexWorkingDir(this.ctx)
  }

}

/**
`Conflict` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Conflict extends State {

  enter (err, policy) {
    this.ctx.ctx.indexConflictDir(this.ctx)
    this.err = err
    this.policy = policy
  }

  exit () {
    this.ctx.ctx.unindexConflictDir(this.ctx)
  }

  view () {
    return {
      error: {
        code: this.err.code,
        xcode: this.err.xcode,
        message: this.err.message
      },
      policy: this.policy
    }
  }

}

/**
`Reading` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Reading extends State {

  enter () {
    this.ctx.ctx.indexReadingDir(this.ctx)
    this.read((err, xstats) => {
      if (this.ctx.isDestroyed()) return
      if (err) {
        this.setState('Failed', err)
      } else {
        this.setState('Read', xstats)
      }
    })
  }

  read (callback) {
    this.ctx.ctx.readdir(this.ctx.src.uuid, callback)
  }

  exit () {
    this.ctx.ctx.unindexReadingDir(this.ctx)
  }

}

/**
`Read` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Read extends State {

  enter (xstats) {
    this.ctx.ctx.indexReadDir(this.ctx)

    this.dstats = xstats.filter(x => x.type === 'directory')
    this.fstats = xstats.filter(x => x.type === 'file')
    this.next()
  }

  next () {
    // if task is distroied, the rest files won't enter task queue
    if (!this.ctx.ctx) return
    if (this.fstats.length) {
      let stat = this.fstats.shift()
      let sub = this.ctx.createSubTask(stat)
      sub.once('Conflict', () => this.next())
      sub.once('Failed', () => this.next())
      sub.once('Finished', () => (sub.destroy(), this.next()))
      return
    }

    if (this.dstats.length) {
      let stat = this.dstats.shift()
      let sub = this.ctx.createSubTask(stat)
      sub.once('Conflict', () => this.next())
      sub.once('Failed', () => this.next())
      sub.once('Finished', () => (sub.destroy(), this.next()))
      return
    }

    if (this.ctx.children.length === 0) {
      this.setState('Finished')
    }

    if (this.fstats.length === 0 && this.dstats.length === 0 && this.ctx.children.length !== 0) {
      if (this.ctx.parent) this.ctx.parent.state.next()
    }
  }

  exit () {
    this.ctx.ctx.unindexReadDir(this.ctx)
  }

}

/**
`Failed` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Failed extends State {

  // when directory enter failed
  // all descendant node are destroyed (but not removed)
  enter (err) {
    this.ctx.ctx.indexFailedDir(this.ctx)

    let children = [...this.ctx.children]
    children.forEach(c => c.destroy())

    this.err = err
  }

  exit () {
    this.ctx.ctx.unindexFailedDir(this.ctx)
  }

  view () {
    return {
      error: {
        code: this.err.code,
        message: this.err.message
      }
    }
  }

}

/**
`Finished` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Finished extends State {

  enter () {
    // let p = ['keep', 'skip']
    // delete the dir which is keep or skip in DirMove
    if (this.ctx.constructor.name === 'DirMove') { // && (p.includes(this.ctx.policy[0]) || p.includes(this.ctx.ctx.policies.dir[0]))) {
      let dirveUUID = this.ctx.ctx.srcDriveUUID
      let dir = this.ctx.ctx.ctx.vfs.getDriveDirSync(dirveUUID, this.ctx.src.uuid)
      let dirPath = this.ctx.ctx.ctx.vfs.absolutePath(dir)
      if (this.ctx.parent) {
        try {
          let files = fs.readdirSync(dirPath)
          if (!files.length) rimraf.sync(dirPath)
        } catch (e) {
          if (e.code !== 'ENOENT') throw e
        }
      }
    }

    this.ctx.ctx.indexFinishedDir(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexFinishedDir(this.ctx)
  }

}

/**
The base class of sub-task for directory.

@memberof XCopy
@extends XCopy.Node
*/
class Dir extends Node {

  constructor (ctx, parent, src, dst, entries) {
    super(ctx, parent)
    this.children = []
    this.src = src
    if (dst) {
      this.dst = dst
      new this.Read(this, entries)
    } else {
      new this.Pending(this)
    }
  }

  get type () {
    return 'directory'
  }

  destroy () {
    let children = [...this.children]
    children.forEach(c => c.destroy())
    super.destroy()
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.dir[0] || null,
      this.policy[1] || this.ctx.policies.dir[1] || null
    ]
  }

  // virtual
  createSubTask (xstat) {
    let src = { uuid: xstat.uuid, name: xstat.name }
    if (xstat.type === 'directory') {
      return new this.constructor(this.ctx, this, src)
    } else {
      return new this.constructor.File(this.ctx, this, src)
    }
  }

}

Dir.prototype.Pending = Pending
Dir.prototype.Working = Working
Dir.prototype.Reading = Reading
Dir.prototype.Read = Read
Dir.prototype.Conflict = Conflict
Dir.prototype.Finished = Finished
Dir.prototype.Failed = Failed

module.exports = Dir
