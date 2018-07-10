// const rimraf = require('rimraf')
// const fs = require('fs')

const UUID = require('uuid')
const debug = require('debug')('xdir')

const XNode = require('./xnode')
const XFile = require('./xfile')

class State {
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.enter(...args)

    debug(`${this.ctx.src.name || '[root]'} entered ${this.constructor.name}`)

    this.ctx.ctx.reqSched()
    this.ctx.emit('StateEntered', this.constructor.name)
  }

  isDestroyed () {
    return this.ctx.isDestroyed()
  }

  getPolicy () {
    return this.ctx.getPolicy()
  }

  enter () { }
  exit () { }

  setState (State, ...args) {
    this.exit()
    this.ctx.state = new State(this.ctx, ...args)
  }

  destroy () {
    this.exit()
  }

  updatePolicy () {
  }

  view () {
  }

  tryFinish () {
    debug(`${this.ctx.src.name} tryFinish`)
    let task = this.ctx.ctx
    let dir = this.ctx
    let { type } = task
    let srcDrive = task.src.drive
    let dstDrive = task.dst.drive

    /**
    literal move, effective copy should clean src
    including imove, emove, and nmove between distinct drives
    */
    if (dir.parent === null) { // no rmdir for root
      this.setState(Finish)
    } else if (type === 'imove' ||
      type === 'emove' ||
      (type === 'nmove' && srcDrive !== dstDrive) ||
      (type === 'move' && this.ctx.kept === true) ||
      (type === 'nmove' && srcDrive === dstDrive && this.ctx.kept === true)) {
      this.setState(Finishing)
    } else {
      this.setState(Finish)
    }
  }
}

/**
Making (or Moving) target directory

Entering this state when user try to resolve name conflict by single or global policy
*/
class Mkdir extends State {
  enter () {
    let task = this.ctx.ctx
    let dir = this.ctx
    let pdir = dir.parent
    let { user, type, vfs, nfs } = task
    let srcDrive = task.src.drive
    let dstDrive = task.dst.drive
    let name = dir.src.name
    let names = [name]

    let _policy = dir.getPolicy()
    let policy = [_policy[0] === 'keep' ? 'skip' : _policy[0], _policy[1]]

    let props, f

    if (type === 'copy' || type === 'icopy' || type === 'imove') {
      props = {
        driveUUID: dstDrive,
        dirUUID: this.ctx.parent.dst.uuid,
        names,
        policy
      }
      f = vfs.MKDIRS.bind(vfs)
    } else if (type === 'move') {
      props = {
        src: { drive: srcDrive, dir: pdir.src.uuid },
        dst: { drive: dstDrive, dir: pdir.dst.uuid },
        names,
        policy
      }
      f = vfs.MVDIRS.bind(vfs)
    } else if (type === 'nmove' && srcDrive === dstDrive) {
      props = {
        id: srcDrive,
        srcPath: pdir.namepath(),
        dstPath: pdir.dstNamePath(),
        names,
        policy
      }
      f = nfs.MVDIRS.bind(nfs)
    } else {
      props = {
        id: dstDrive,
        path: pdir.dstNamePath(),
        names,
        policy
      }
      f = nfs.MKDIRS.bind(nfs)
    }

    f(user, props, (err, map) => {
      if (this.isDestroyed()) return
      if (err) {
        this.setState(Failed, err)
      } else {
        let { err, stat, resolved } = map.get(name)
        if (err) {
          if (err.code === 'EEXIST') {
            this.setState(Conflict, err, _policy)
          } else {
            this.setState(Failed, err)
          }
        } else {
          if (type === 'move' || (type === 'nmove' && srcDrive === dstDrive)) {
            // 3. successful move does NOT generate child job, unless keep resovled
            if (_policy[0] === 'keep' && resolved[0] === true) {
              this.ctx.kept = true
              this.ctx.dst = { uuid: stat.uuid, name: stat.name }
              this.setState(Preparing)
            } else {
              this.tryFinish()
            }
          } else {
            // 3. successful copy generates child dir job, unless skipped resovled
            if ((_policy[0] === 'skip' && resolved[0] === true) || (_policy[1] === 'skip' && resolved[1] === true)) {
              this.setState(Finish)
            } else {
              // console.log(policy, _policy)
              // console.log(err, map)
              this.ctx.dst = { uuid: stat.uuid, name: stat.name }
              this.setState(Preparing)
            }
          }
        }
      }
    })
  }
}

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

  updatePolicy (policy) {
    if (policy) {
      let p = this.ctx.policy
      p[0] = policy[0] || p[0]
      p[1] = policy[1] || p[1]
    }
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
    let task = this.ctx.ctx
    let dir = this.ctx

    let { user, type, vfs, nfs, entries } = task
    let srcDrive = task.src.drive
    let props, fs

    if (type === 'copy' ||
      type === 'move' ||
      type === 'ecopy' ||
      type === 'emove') {
      props = { driveUUID: srcDrive, dirUUID: dir.src.uuid }
      fs = vfs
    } else if (type === 'icopy' ||
      type === 'imove' || type === 'ncopy' || type === 'nmove') {
      props = { id: srcDrive, path: dir.namepath() }
      fs = nfs
    } else {
      let err = new Error(`invalid task type ${type}`)
      return this.setState(Failed, err)
    }

    fs.READDIR(user, props, (err, stats) => {
      if (this.isDestroyed()) return
      if (err) {
        this.setState(Failed, err)
      } else {
        let fstats = []
        let dstats = []

        // filter children for root node
        if (dir.parent === null) {
          entries.forEach(entry => {
            let stat = stats.find(x => x.name === entry)
            if (stat) {
              if (stat.type === 'directory') {
                dstats.push(stat)
              } else {
                fstats.push(stat)
              }
            } else {
              // ignore missing
            }
          })
        } else {
          fstats = stats.filter(x => x.type === 'file')
          dstats = stats.filter(x => x.type === 'directory')
        }

        if (dstats.length === 0 && fstats.length === 0) { // no sub tasks
          this.tryFinish()
        } else if (dstats.length === 0) { // only sub-file tasks
          this.setState(Parent, dstats, fstats)
        } else {
          this.batch(dstats, fstats)
        }
      }
    })
  }

  // mkdirs or mvdirs in batch mode
  batch (dstats, fstats) {
    let task = this.ctx.ctx
    let dir = this.ctx
    let { type, user, vfs, nfs } = task
    let srcDrive = task.src.drive
    let dstDrive = task.dst.drive
    let _policy = this.ctx.getGlobalPolicy()
    let policy = [_policy[0] === 'keep' ? 'skip' : _policy[0], _policy[1]]
    let names = dstats.map(x => x.name)
    let props, f

    const sameNfsDrive = () => this.ctx.ctx.src.drive === this.ctx.ctx.dst.drive

    /**
    1. copy     mkdirs in vfs
    2. move     mvdirs in vfs
    3. icopy    mkdirs in vfs
    4. imove    mkdirs in vfs   post-clean
    5. ecopy    mkdirs in nfs
    6. emove    mkdirs in nfs   post-clean
    7. ncopy    mkdirs in nfs
    8. nmove1   mkdirs in nfs   post-clean    when src & dst @ diff fs
       nmove2   mvdirs in nfs                 when src & dst @ same fs
    */
    if (type === 'copy' || type === 'icopy' || type === 'imove') { // mkdirs in vfs
      props = { driveUUID: dstDrive, dirUUID: dir.dst.uuid, names, policy }
      f = vfs.MKDIRS.bind(vfs)
    } else if (type === 'move') { // mvdirs in vfs
      props = {
        src: { drive: srcDrive, dir: dir.src.uuid },
        dst: { drive: dstDrive, dir: dir.dst.uuid },
        names,
        policy
      }
      f = vfs.MVDIRS.bind(vfs)
    } else if (type === 'nmove' && sameNfsDrive()) { // mvdirs in nfs
      props = {
        id: srcDrive,
        srcPath: dir.namepath(),
        dstPath: dir.dstNamePath(),
        names,
        policy
      }
      f = nfs.MVDIRS.bind(nfs)
    } else { // mkdirs in nfs
      props = { id: dstDrive, path: dir.dstNamePath(), names, policy }
      f = nfs.MKDIRS.bind(nfs)
    }

    f(user, props, (err, map) => {
      if (this.isDestroyed()) return
      if (err) {
        debug('Preparing, batch mkdir/mvdir failed', err, names)
        return this.setState(Failed, err)
      }

      /**
      annotate {
        policy: // required by parent state
        dst: { err, stat, resolved }
      }
      */
      dstats.forEach(x => {
        x.policy = _policy
        x.dst = map.get(x.name)
      })

      // we consider effective copy and effective move, instead of literal ones
      if (type === 'move' || (type === 'nmove' && sameNfsDrive())) {
        // 1. err dropped
        // 2. conflict will generate child
        // 3. successful move does NOT generate child dir job, unless keep resolved
        dstats = dstats.filter(x => {
          if (x.dst.err) {
            return x.dst.err.code === 'EEXIST'
          } else {
            if (_policy[0] === 'keep' && x.dst.resolved[0]) {
              x.kept = true
              return true
            } else {
              return false
            }
          }
        })
      } else {
        // 1. err dropped
        // 2. conflict will generate child
        // 3. successful copy does generate child dir job, unless skipped
        dstats = dstats.filter(x => {
          if (x.dst.err) {
            return x.dst.err.code === 'EEXIST'
          } else {
            if (_policy[0] === 'skip' && x.dst.resolved[0]) return false
            if (_policy[1] === 'skip' && x.dst.resolved[1]) return false
            return true
          }
        })
      }

      if (dstats.length === 0 && fstats.length === 0) {
        this.tryFinish()
      } else {
        this.setState(Parent, dstats, fstats)
      }
    })
  }
}

class Parent extends State {
  // dstat { dst: { err, stat, resolved } }
  enter (dstats, fstats) {
    this.ctx.dstats = dstats.filter(x => !x.dst.err)
    this.ctx.fstats = fstats
    dstats.filter(dstat => dstat.dst.err)
      .forEach(dstat => this.ctx.createConflictSubDir(dstat))
  }
}

class Failed extends State {
  enter (err) {
    if (process.env.LOGE) console.log('xdir failed', err.message)
    this.error = err
  }
}

class Finishing extends State {
  enter () {
    let task = this.ctx.ctx
    let dir = this.ctx
    let { user, type, vfs, nfs } = task
    let srcDrive = task.src.drive
    if (type === 'move' || type === 'emove') { // src is in vfs
      let props = {
        driveUUID: srcDrive,
        dirUUID: dir.src.uuid,
        name: dir.src.name // for display only
      }
      vfs.RMDIR(user, props, err => {
        if (this.isDestroyed()) return
        if (err) {
          this.setState(Failed, err)
        } else {
          this.setState(Finish)
        }
      })
    } else { // src is in nfs
      let props = { drive: srcDrive, dir: dir.namepath() }
      nfs.RMDIR(user, props, err => {
        if (this.isDestroyed()) return
        if (err) {
          this.setState(Failed, err)
        } else {
          this.setState(Finish)
        }
      })
    }
  }
}

class Finish extends State {}

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
    Object.defineProperty(this, 'type', { value: 'directory', writable: false })
    this.children = []
    this.src = src
    if (!src.uuid) src.uuid = UUID.v4()
    if (dst instanceof Error) {
      let err = dst
      let policy = entries
      this.state = new Conflict(this, err, policy)
    } else {
      this.dst = dst
      this.state = new Preparing(this, entries)
    }
  }

  destroy () {
    this.children.forEach(c => c.destroy())
    super.destroy()
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.dir[0] || null,
      this.policy[1] || this.ctx.policies.dir[1] || null
    ]
  }

  getGlobalPolicy () {
    return [
      this.ctx.policies.dir[0] || null,
      this.ctx.policies.dir[1] || null
    ]
  }

  /**
  This function is used when entering Parent state
  */
  createConflictSubDir (dstat) {
    let dir = new XDir(this.ctx, this, {
      uuid: dstat.uuid || UUID.v4(),
      name: dstat.name
    }, dstat.dst.err)

    dir.on('StateEntered', state => {
      if (state === 'Failed' || state === 'Finish') {
        dir.destroy()
        this.children.splice(this.children.indexOf(dir), 1)
        if (this.children.length === 0 &&
          this.dstats.length === 0 &&
          this.fstats.length === 0) this.state.tryFinish()
      }
    })

    this.children.push(dir)
  }

  /**
  This function is used by scheduler

  @param {number} required
  @returns actual created
  */
  createSubDir (required) {
    if (required === 0) return 0
    if (this.stateName() !== 'Parent') return 0
    if (!this.dstats || this.dstats.length === 0) return 0

    let arr = this.dstats.splice(0, required)
    arr.forEach(dstat => {
      let src = { uuid: dstat.uuid || UUID.v4(), name: dstat.name }
      let dst = { uuid: dstat.dst.stat.uuid, name: dstat.dst.stat.name }
      let dir = new XDir(this.ctx, this, src, dst)

      // quick fix
      if (dstat.policy[0] === 'keep' && dstat.dst.resolved[0] === true) dir.kept = true

      dir.on('StateEntered', state => {
        if (state === 'Failed' || state === 'Finish') {
          dir.destroy()
          this.children.splice(this.children.indexOf(dir), 1)
          if (this.children.length === 0 &&
            this.dstats.length === 0 &&
            this.fstats.length === 0) {
            this.state.tryFinish()
          }
        }
      })

      this.children.push(dir)
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
    if (this.stateName() !== 'Parent') return 0
    if (!this.fstats || this.fstats.length === 0) return 0

    let arr = this.fstats.splice(0, required)
    arr.forEach(fstat => {
      let file = new XFile(this.ctx, this, { uuid: fstat.uuid || UUID.v4(), name: fstat.name })
      file.on('StateEntered', state => {
        if (state === 'Failed' || state === 'Finish') {
          file.destroy()
          this.children.splice(this.children.indexOf(file), 1)
          if (this.children.length === 0 &&
            this.dstats.length === 0 &&
            this.fstats.length === 0) {
            this.state.tryFinish()
          }
        }
      })
      this.children.push(file)
    })

    return arr.length
  }
}

module.exports = XDir
