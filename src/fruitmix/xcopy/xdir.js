const rimraf = require('rimraf')
const fs = require('fs')

const UUID = require('uuid')
const debug = require('debug')('xdir')

const XNode = require('./xnode')
const XFile = require('./xfile')

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

  /**
  */
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
          let type = this.ctx.ctx.type
          let boundF
 
          if (type === 'copy' || type === 'import') {
            boundF = this.ctx.mkdirs.bind(this.ctx)
          } else if (type === 'move') {
            boundF = this.ctx.mvdirs.bind(this.ctx)
          } else if (type === 'export') {
            boundF = this.ctx.mkdirs.bind(this.ctx)
          }

          boundF(names, (err, map) => { //
            if (err) {
              debug('xdir mkdirs/mvdirs failed', err, names)
              // TODO
              this.setState(Failed, err)
            } else {
              dstats.forEach(x => x.dst = map.get(x.name))
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

    // 生成失败文件夹对象
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
    debug('xdir enter failed state', err)
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

*/
class XDir extends XNode {
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

    // 失败任务处理
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
          // children任务进入失败或或完成状态， 将任务从children中移除
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
      let file = new XFile(this.ctx, this, { uuid: fstat.uuid || UUID.v4(), name: fstat.name })
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
    if (this.ctx.type === 'copy' || this.ctx.type === 'move' || this.ctx.type === 'export') {
      let props = {
        driveUUID: this.ctx.src.drive,
        dirUUID: this.src.uuid
      }
      this.ctx.vfs.READDIR(this.ctx.user, props, callback)
    } else if (this.ctx.type === 'import') {
      let props = {
        id: this.ctx.src.drive,
        path: this.namepath()
      }

      this.ctx.nfs.READDIR(this.ctx.user, props, callback)
    }
  }

  mkdirs (names, callback) {
    if (this.ctx.type === 'copy' || this.ctx.type === 'import') {
      let policy = this.getPolicy() // FIXME this should be global policy, not local one
      let props = {
        driveUUID: this.ctx.dst.drive,
        dirUUID: this.dst.uuid,
        names,
        policy
      }

      this.ctx.vfs.MKDIRS(this.ctx.user, props, callback)
    } else if (this.ctx.type === 'export') {
      let policy = this.getPolicy() // FIXME this shoudl be global policy
      let props = {
        id: this.ctx.dst.drive,
        path: this.dst.name,
        names,
        policy
      }
      this.ctx.nfs.MKDIRS(this.ctx.user, props, callback)
    }
  }

  mvdirs (names, callback) {
    let src = { drive: this.ctx.src.drive, dir: this.src.uuid }
    let dst = { drive: this.ctx.dst.drive, dir: this.dst.uuid }
    let policy = this.getPolicy()
    this.ctx.vfs.MVDIRS(this.ctx.user, { src, dst, names, policy }, callback)
  }

}

module.exports = XDir
