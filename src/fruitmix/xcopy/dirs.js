const rimraf = require('rimraf')
const fs = require('fs')

const UUID = require('uuid')

const Node = require('./node')

const { FileCopy, FileMove, FileImport, FileExport } = require('./files')
const mkdir = require('./lib').mkdir


class State {

  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.destroyed = false

    this.ctx.ctx.indexDir(this.getState(), this.ctx)
    this.enter(...args)
  }

  enter () {}
  exit () {}

  getState () {
    return this.constructor.name
  }

  setState (state, ...args) {
    this.exit()
    this.ctx.ctx.unindexDir(this.getState(), this.ctx)

    let NextState = this.ctx[state]
    new NextState(this.ctx, ...args)
  }

  destroy () {
    this.destroyed = true

    this.exit()
    this.ctx.ctx.unindexDir(this.getState(), this.ctx)
  }
}

/**
`Pending` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Pending extends State { }

/**
`Working` state for directory sub-task

The destination directory (`dst`) should be created in this state.

@memberof XCopy.Dir
@extends XCopy.State
*/
class Working extends State {

  enter () {
    let [same, diff] = policy
    if (same === 'keep') same = 'skip'
    this.mkdir([same, diff], (err, dst, resolved) => {
      if (this.destroyed) return
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
}

/**
`Conflict` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Conflict extends State {

  enter (err, policy) {
    this.err = err
    this.policy = policy
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
    this.read((err, xstats) => {
      if (this.destroyed) return 
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
}

/**
`Read` state for directory sub-task

@memberof XCopy.Dir
@extends XCopy.State
*/
class Read extends State {

  enter (xstats) {
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
  }
}

/**
The base class of sub-task for directory.

@memberof XCopy
@extends XCopy.Node
*/
class Dir extends Node {

  /**
  
  @param {object} ctx - task container
  @param {Dir} parent - parent dir node
  @param {object} src - source object
  @param {string} src.drive - source drive uuid or device name
  */
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

Object.assign(Dir.prototype, { Pending, Working, Reading, Read, Conflict, Finished, Failed })

class DirCopy extends Dir {}

DirCopy.File = FileCopy

DirCopy.prototype.Working = class extends Working {

  mkdir (policy, callback) {
    let src = { dir: this.ctx.src.uuid }
    let dst = { dir: this.ctx.parent.dst.uuid }
    this.ctx.ctx.cpdir(src, dst, policy, (err, xstat, resolved) => {
      if (err) {
        callback(err)
      } else {
        if (!xstat) return callback(null, null, resolved)
        let dst2 = { uuid: xstat.uuid, name: xstat.name }
        callback(null, dst2, resolved)
      }
      // if (err && err.code === 'EEXIST') {
      //   this.setState('Conflict', err, policy)
      // } else if (err) {
      //   this.setState('Failed', err)
      // } else {
      //   this.setState('Finished')
      // }
    })
  }

}


class DirMove extends Dir {}

DirMove.File = FileMove

/**
`Working` state for DirMove sub-task

The destination directory (`dst`) should be created in this state.

@memberof XCopy.DirCopy
@extends XCopy.State
*/
DirMove.prototype.Working = class extends Working {

  mkdir (policy, callback) {
    let src = { dir: this.ctx.src.uuid }
    let dst = { dir: this.ctx.parent.dst.uuid }   
    this.ctx.ctx.mvdir(src, dst, policy, (err, xstat, resolved) => {
      if (err) {
        callback(err)
      } else {
        if (!xstat) return callback(null, null, resolved)
        let dst = { uuid: xstat.uuid, name: xstat.name }
        callback(null, dst, resolved)
      }

      // if (err && err.code === 'EEXIST') {
      //   callback(err)
      //   this.setState('Conflict', err, policy)      
      // } else if (err) {
      //   callback(err)
      //   this.setState('Failed', err)       
      // } else {
      //   let dst = { uuid: xstat.uuid, name: xstat.name }
      //   callback(null, dst, resolved)
      //   this.setState('Finished')      
      // }

      // if (err && err.code === 'EEXIST') {
      //   this.setState('Conflict', err, policy)
      // } else if (err) {
      //   this.setState('Failed', err)
      // } else {
      //   this.setState('Finished')
      // }
    })
  }
}

class DirImport extends Dir { 

  /**
  Returns subtask from native file system stat 

  @override
  */
  createSubTask (stat) {
    let src = {
      uuid: UUID.v4(),
      name: stat.name,
      path: path.join(this.src.path, stat.name)
    }

    if (stat.type === 'directory') {
      return new DirImport(this.ctx, this, src)
    } else {
      return new FileImport(this.ctx, this, src)
    }
  }

}

DirImport.File = FileImport

/**
Working state for DirImport

@memeberof XCopy.DirImport
*/
DirImport.prototype.Working = class extends Working {

  mkdir (policy, callback) {
    let dst = {
      dir: this.ctx.parent.dst.uuid,
      name: this.ctx.src.name,
    }

    this.ctx.ctx.mkdir(dst, policy, (err, xstat, resolved) => {
      if (err) {
        callback(err)
      } else {
        if (!xstat) return callback(null, null, resolved)
        let dst2 = { uuid: xstat.uuid, name: xstat.name }
        callback(null, dst2, resolved)
      }
    })
  }
}

DirImport.prototype.Reading = class extends Reading {

  /**
  Returns stats of source directory
  */
  read (callback) {
    let srcPath = this.ctx.src.path
    fs.readdir(srcPath, (err, files) => {
      if (err) return callback(err)
      if (files.length === 0) return callback(null, [])
      let count = files.length
      let stats = []
      files.forEach(file => {
        fs.lstat(path.join(srcPath, file), (err, stat) => {
          if (!err && (stat.isDirectory() || stat.isFile())) {
            if (stat.isDirectory()) {
              stats.push({
                type: 'directory',
                name: file
              })
            } else {
              stats.push({
                type: 'file',
                name: file,
                size: stat.size,
                mtime: stat.mtime.getTime()
              })
            }
          }

          if (!--count) callback(null, stats)
        })
      })
    })
  }

}

class DirExport extends Dir {}

DirExport.File = FileExport

DirExport.prototype.Working = class extends Working {

  mkdir (policy, callback) {
    let name = this.ctx.src.name
    let dstPath = path.join(this.ctx.parent.dst.path, name)
    mkdir(dstPath, policy, (err, dst, resolved) => {
      if (err) {
        callback(err)
      } else {
        let dst2 = {
          name: this.ctx.src.name,
          path: dst || dstPath
        }
        callback(null, dst2, resolved)
      }
    }) 
  }
} 


module.exports = {
  Dir,
  DirCopy,
  DirMove,
  DirImport,
  DirExport
}

