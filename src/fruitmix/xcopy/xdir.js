const rimraf = require('rimraf')
const fs = require('fs')

const UUID = require('uuid')
const debug = require('debug')('xdir')

const Node = require('./node')
const XFile = require('./xfile')

const mkdir = require('./lib').mkdir

class State {
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.destroyed = false
    this.enter(...args)

    let state = this.constructor.name
    debug(`${this.ctx.src.name || '[root]'} entered ${state}`)
    this.ctx.ctx.reqSched()

    this.ctx.emit('StateEntered', state)
  }

  enter () {}
  exit () {}

  getState () {
    return this.constructor.name
  }

  setState (NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  destroy () {
    this.destroyed = true
    this.exit()
  }

  policyUpdated () {
  }

  view () {
  }
}

/**
Making target directory

Entering this state when user try to resolve name conflict by single or global policy
*/
class Mkdir extends State {
  enter () {
    let policy = this.ctx.getPolicy()

    let [same, diff] = policy
    if (same === 'keep') same = 'skip'

    this.mkdir([same, diff], (err, dst, resolved) => {
      if (this.destroyed) return
      if (err && err.code === 'EEXIST') {
        this.setState(Conflict, err, policy)
      } else if (err) {
        this.setState(Failed, err)
      } else {

        // FIXME TODO process move separately

        // global keep, no conflict, resolved: [false, false], dirmove should finished
/**
        let action = this.ctx.constructor.name
        let p = ['rename', 'replace']
        if ((policy[0] === 'skip' && resolved[0]) ||
        (policy[1] === 'skip' && resolved[1]) ||// for dir-copy diff skip
         (action === 'DirMove' && (!resolved[0] || p.includes(policy[0])))) { // in DirMove rename and replace move the whole directory once
          this.setState(Finished)
        } else {
          this.ctx.dst = dst
          this.setState(Reading)
        }
*/

        if (policy[0] === 'skip' && resolved[0]) { // skip policy resolved
          this.setState(Finish)
        } else if (policy[1] === 'skip' && resolved[1]) {
          this.setState(Finish)
        } else {
          this.ctx.dst = { uuid: dst.uuid, name: dst.name }
          this.setState(Preparing)
        }
      }
    })
  }

  mkdir (policy, callback) {
    if (this.ctx.ctx.type === 'copy') {
      let name = this.ctx.src.name
      let props = {
        driveUUID: this.ctx.ctx.dst.drive,
        dirUUID: this.ctx.parent.dst.uuid,
        names: [name],
        policy
      }

      this.ctx.ctx.vfs.MKDIRS(this.ctx.ctx.user, props, (err, map) => {
        if (err) {
          callback(err)
        } else {
          let { err, stat, resolved } = map.get(name)
          callback(err, stat, resolved)
        }
      })
    } else {
      let err = new Error('not implemented yet')
      err.status = 500
      callback(err)
    }
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
        xcode: this.err.xcode
      },
      policy: this.policy
    }
  }

  policyUpdated () {
    this.setState(Mkdir)
  }
}

/**
`Read` state for directory sub-task

*/
/**
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
**/

/**
Preparing state has target dir ready.

1. read source dir entries
2. make corresponding target dir in batch mode
3. pass fstats, dstats (decorated) to parent if any
4. or go to finish state
*/
class Preparing extends State {
  enter () {
    this.ctx.readdir((err, stats) => {
      if (err) {
        debug(err.message)
        this.setState(Failed)
      } else {
        let fstats = []
        let dstats = []

        if (this.ctx.parent === null) { // root dir
          this.ctx.ctx.entries.forEach(entry => {
            let stat = stats.find(x => x.name === entry)
            if (stat) {
              if (stat.type === 'directory') {
                dstats.push(stat)
              } else {
                fstats.push(stat)
              }
            } else {
              // TODO
            }
          })
        } else {
          fstats = stats.filter(x => x.type === 'file')
          dstats = stats.filter(x => x.type === 'directory')
        }

        if (dstats.length === 0 && fstats.length === 0) { // no sub tasks
          this.setState(Finish)
        } else if (dstats.length === 0) { // only sub-file tasks
          this.setState(Parent, dstats, fstats)
        } else {
          let names = dstats.map(x => x.name)
          this.ctx.mkdirs(names, (err, map) => { //
            if (err) {
              debug('xdir mkdirs failed', err, names)
              // TODO
              this.setState(Failed, err)
            } else {
              dstats.forEach(x => x.dst = map.get(x.name))

              // TODO log failed

              // remove failed
              let dstats2 = dstats.filter(x => (x.dst.err && x.dst.err.code === 'EEXIST') || !x.dst.err)

              if (dstats2.length === 0 && fstats.length === 0) {
                this.setState(Finished)
              } else {
                this.setState(Parent, dstats2, fstats)
              }
            }
          })
        }
      }
    })
  }

  view () {
    return {
      hello: 'world'
    }
  }
}

class Parent extends State {
  /**
  dstat {
    dst: { err, stat, resolved }
  }
  */
  enter (dstats, fstats) {
    this.ctx.dstats = dstats.filter(x => !x.dst.err)
    this.ctx.fstats = fstats

    dstats
      .filter(x => x.dst.err)
      .forEach(x => {
        let dir = new XDir(this.ctx.ctx, this.ctx, { uuid: x.uuid, name: x.name }, x.dst.err)
        dir.on('StateEntered', state => {
          if (state === 'Failed' || state === 'Finish') {
            dir.destroy()
            if (this.ctx.children.length === 0
              && this.ctx.dstats.length === 0
              && this.ctx.fstats.length === 0) this.ctx.setState(Finish)
          }
        })
      })
  }

  view () {
    return {
      state: 'Parent'
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
    debug('xdir enter failed state', err.message)
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
class Finish extends State {
  enter () {

    /**
    // let p = ['keep', 'skip']
    // delete the dir which is keep or skip in DirMove
    if (this.ctx.constructor.name === 'DirMove') {
      // && (p.includes(this.ctx.policy[0]) || p.includes(this.ctx.ctx.policies.dir[0]))) {
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

*/
  }
}

/**
The base class of sub-task for directory.

@memberof XCopy
@extends XCopy.Node
*/
class XDir extends Node {
  /**

  creating a xdir @ preparing with src, dst, and optional entries
  creating a xdir @ conflicting with src, err, policy

  @param {object} ctx - task container
  @param {Dir} parent - parent dir node
  @param {object} src - source object
  @param {string} src.uuid - required, as the identifier of this sub task.
  @param {string} src.name - required
  @parma {object} dst - destination object
  @param {string} dst.name - required
  */
  constructor (ctx, parent, src, dst, entries) {
    super(ctx, parent)
    this.children = []
    this.src = src

    if (dst instanceof Error) {
      let err = dst
      let policy = entries
      new Conflict(this, err, policy)
    } else {
      this.dst = dst
      new Preparing(this, entries)
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

  updatePolicy (policy) {
    if (this.state.constructor.name !== 'Conflict') return
    this.policy[0] = policy[0] || this.policy[0]
    this.policy[1] = policy[1] || this.policy[1]
    this.state.policyUpdated()
  }

  policyUpdated (policy) {
    this.state.policyUpdated()
  }

  /**
  This function is used by scheduler

  @param {number} required
  @returns actual created
  */
  createSubDir (required) {
    if (required === 0) return 0
    if (this.state.constructor.name !== 'Parent') return 0
    if (!this.dstats || this.dstats.length === 0) return 0

    let arr = this.dstats.splice(0, required)
    arr.forEach(dstat => {
      let src = { uuid: dstat.uuid, name: dstat.name }
      let dst = { uuid: dstat.dst.stat.uuid, name: dstat.dst.stat.name }
      let dir = new XDir(this.ctx, this, src, dst)
      dir.on('StateEntered', state => {
        if (state === 'Failed' || state === 'Finish') {
          dir.destroy()
          if (this.children.length === 0 &&
            this.dstats.length === 0 &&
            this.fstats.length === 0) { this.setState(Finish) }
        }
      })
    })

    return arr.length
  }

  /**
  This function is used by scheduler

  @param {number} required
  @returns actual created
  */
  createSubFile (required) {
    if (required === 0) return 0
    if (this.state.constructor.name !== 'Parent') return 0
    if (!this.fstats || this.fstats.length === 0) return 0

    let arr = this.fstats.splice(0, required)
    arr.forEach(fstat => {
      let file = new XFile(this.ctx, this, { uuid: fstat.uuid, name: fstat.name })
      file.on('StateEntered', state => {
        if (state === 'Failed' || state === 'Finish') {
          file.destroy()
          if (this.children.length === 0 &&
            this.dstats.length === 0 &&
            this.fstats.length === 0) { this.setState(Finish) }
        }
      })
    })

    return arr.length
  }

  readdir (callback) {
    if (this.ctx.type === 'copy') {
      let props = {
        driveUUID: this.ctx.src.drive,
        dirUUID: this.src.uuid
      }

      this.ctx.vfs.READDIR(this.ctx.user, props, callback)
    } else {
      let err = new Error('not implemented yet')
      process.nextTick(() => callback(err))
    }
  }

  mkdirs (names, callback) {
    if (this.ctx.type === 'copy') {
      let policy = this.getPolicy()

      let props = {
        driveUUID: this.ctx.dst.drive,
        dirUUID: this.dst.uuid,
        names,
        policy
      }

      this.ctx.vfs.MKDIRS(this.ctx.user, props, callback)
    }
  }
}

/**
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

*/

module.exports = XDir
