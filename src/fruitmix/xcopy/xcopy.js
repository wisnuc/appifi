const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const UUID = require('uuid')
const debug = require('debug')('xcopy')

const XDir = require('./xdir')
const XFile = require('./xfile')


/**

This is a container of a collection of sub-tasks, organized in a tree.
*/
class XCopy extends EventEmitter {

  // if user is not provided, ctx is vfs, otherwise, it is fruitmix

  /**
  @param {object} user
  @param {object} props
  @param {object} props.src
  @param {string} props.src.drive - vfs drive uuid or nfs drive id
  @param {string} props.src.dir - vfs dir uuid or nfs dir path
  */
  constructor (vfs, nfs, user, props) {
    super()

    this.finished = false

    this.dirLimit = props.dirLimit || 4
    this.fileLimit = props.fileLimit || 2

    let { type, src, dst, entries, policies, stepping } = props

    this.vfs = vfs
    this.nfs = nfs

    this.stepping = !!stepping

    // stepping mode specific
    this.steppingState = 'Stopped' // or 'Stepping'

    this.type = type
    this.user = user
    this.uuid = UUID.v4()

    this.src = props.src
    this.dst = props.dst
    this.entries = props.entries
    this.policies = props.policies

    if (stepping) {
      debug('xcopy started in stepping mode, stopped')
    } else { 
      this.createRoot()
    }
  }

  /**
  create the root xdir task
  */
  createRoot () {
    let src, dst
    if (this.type === 'copy' || this.type === 'move') {
      src = { uuid: this.src.dir, name: '' }
      dst = { uuid: this.dst.dir, name: '' } 
    } else {
      throw new Error('not implemented')
    }

    let root = new XDir(this, null, src, dst, this.entries)
    root.on('StateEntered', state => {
      // root starts from preparing state, it may go to failed state directory, 
      // or reach finish state via parent. Only these four state is possible.
      if (state === 'Failed' || state === 'Finish') {
        this.finished = true 
        this.root = null
      }
    })

    this.root = root
  }

  destroy () {
    this.root.destroy()
  }

  // not implemented TODO
  pause () {
  } 

  // not implemented TODO
  resume () {
  }

  /**
  Visit task tree, return running and conflict tasks
  */
  count () {
    let runningFile = 0
    let conflictFile = 0
    let runningDir = 0
    let conflictDir = 0

    const F = node => {
      if (node.constructor.name === 'XDir' && node.state.constructor.name === 'Parent') {
        node.children.forEach(c => {
          if (c.constructor.name === 'XFile') {
            let state = c.state.constructor.name
            if (state === 'Working') {
              runningFile++
            } else if (state === 'Conflict') {
              conflictFile++ 
            } else {
              console.log('== panic >>>>')
              console.log(c) 
              console.log('== panic <<<<')
              throw new Error('Unexpected xfile state')
            }
          } else {
            let state = c.state.constructor.name
            if (state === 'Mkdir' || state === 'Preparing') {
              runningDir++
            } else if (state === 'Conflict') {
              conflictDir++
            } else if (state === 'Parent') {
              // do nothing
            } else {
              console.log('== panic >>>>')
              console.log(c) 
              console.log('== panic <<<<')
              throw new Error('Unexpected xdir state')
            }
          }
        })
      }
    }

    if (this.root) {
      let state = this.root.state.constructor.name
      if (state === 'Preparing') {
        runningDir++
      } else if (state === 'Parent') {
        this.root.visit(F)
      } else {
        throw new Error(`root is in ${state} state, expected Preparing or Parent`)
      }
    }

    return { runningFile, conflictFile, runningDir, conflictDir }
  }

  /** 
  
  */
  sched () {
    this.scheduled = false

    let { runningFile, conflictFile, runningDir, conflictDir } = this.count() 

    if (runningFile >= this.fileLimit && runningDir >= this.dirLimit) return

    const schedF = node => {
      if (node.constructor.name === 'XDir' && node.state.constructor.name === 'Parent') {
        runningFile += node.createSubFile(this.fileLimit - runningFile)
        runningDir += node.createSubDir(this.dirLimit - runningDir)
      }

      if (runningFile >= this.fileLimit && runningDir >= this.dirLimit) return true
    } 

    try {
    this.root.visit(schedF)
    } catch (e) {
      console.log(e)
    }
  }

  // this function is called internally from sub tasks
  // in stepping mode, this function is responsible for transition from Stepping to Stopped state
  // any watch callback should be returned if transition occurred
  // in non-stepping mode, this function schedule sched
  reqSched () {
    if (this.stepping) {
      if (this.scheduled) {
        // debug('reqSched already triggered')
        return
      }

      // debug('reqSched triggered')
      this.scheduled = true
      process.nextTick(() => {
        this.scheduled = false
        if (this.steppingState !== 'Stepping') {
          console.log('ERROR: reqSched called @ Stopped state in stepping mode')
        } else {
          let { runningFile, runningDir } = this.count()

          // debug(`schedule, running file ${runningFile}, running dir ${runningDir}`)

          if (runningFile === 0 && runningDir === 0) {

            debug('step stopped')

            this.steppingState = 'Stopped'
            if (this.watchCallback) { 
              this.watchCallback(null, this.view())
              this.watchCallback = null
            }
          }
        }
      })
    } else {
      if (this.scheduled) return
      this.scheduled = true
      process.nextTick(() => this.sched())
    }
  }

  // this function is called externally from clients
  // step can only be called in 'Stopped' state
  step (callback) {
    if (!this.stepping) return process.nextTick(() => callback(null))
    if (this.finished) return process.nextTick(() => callback(null))
    if (this.steppingState === 'Stepping') return process.nextTick(() => callback(null))
    this.steppingState = 'Stepping'

    if (this.root) {
      this.sched()
    } else {
      this.createRoot()
    }
    callback(null, this.view())
  }

  // watch can be called in either Stepping or Stopped mode
  // if stopped, return task view
  // otherwise, return task view until stopped (step end)
  watch (callback) {
    if (!this.stepping) return process.nextTick(() => callback(null))
    if (this.watchCallback) return process.nextTick(() => callback(null))

    let { runningFile, runningDir } = this.count() 
    if (runningFile === 0 && runningDir === 0) {
      process.nextTick(() => callback(null, this.view()))
    } else {
      this.watchCallback = callback
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  //  external/api interface
  //
  //  1. view hierarchy
  //  2. update policy
  //  3. pause / resume (not implemented)
  //  4. destroy (cancel)
  //
  //////////////////////////////////////////////////////////////////////////////

  // in stepping mode, all nodes are pushed into nodes
  // in non-stepping mode, however, only Working files and 
  view () {
    let nodes = []
    if (this.root) {
      if (this.stepping) {
        this.root.visit(n => {
          nodes.push(n.view())
        })
      } else {
        this.root.visit(n => {
          if (n.state.constructor.name === 'Conflict' 
            || (n.constructor.name === 'XFile' && n.state.constructor.name ==='Working'))
            nodes.push(n.view())
        })
      }
    }

    let v = {
      uuid: this.uuid,
      type: this.mode,
      src: this.src,
      dst: this.dst,
      entries: this.entries,
      nodes,

      finished: this.finished,
      stepping: this.stepping
    }

    if (this.stepping) v.steppingState = this.steppingState
    return v
  }

  // this method is used by copy, move and export, but not import
  readdir(srcDirUUID, callback) {
    if (this.user) {
      this.ctx.readdir(this.user, this.srcDriveUUID, srcDirUUID, callback)
    } else {
      this.ctx.readdir(this.srcDriveUUID, srcDirUUID, callback)
    }
  }

  update (uuid, props, callback) {
    let err = null
    let node = this.root.find(n => n.src.uuid === uuid)
    if (!node) {
      err = new Error(`node ${uuid} not found`)
      err.code = 'ENOTFOUND'
      err.status = 404
    } else if (node.getState() !== 'Conflict') {
      console.log(node)
      err = new Error(`node is not in conflict state`)
      err.code = 'EFORBIDDEN'
      err.status = 403
    } else {
      node.update(props)
      if (props.applyToAll) {
        let type = node instanceof Dir ? 'dir' : 'file'
        this.policies[type][0] = props.policy[0] || this.policies[type][0]
        this.policies[type][1] = props.policy[1] || this.policies[type][1]
        // FIXME retry all ?
        if (type === 'dir') [...this.conflictDirs].forEach(n => n.retry())
        else [...this.conflictFiles].forEach(n => n.retry())
      }
    } 

    process.nextTick(() => callback(err))
  }

  delete (uuid, callback) {
    let err = null
    let node = this.root.find(n => n.src.uuid === uuid)
    if (!node) {
      // idempotent
    } else if (node.root() === node) {
      err = new Error(`root node cannot be deleted`)
      err.code = 'EFORBIDDEN'
      err.status = 403
    } else if (node.getState() !== 'Failed') {
      err = new Error(`node is not in Failed state`)
      err.code = 'EFORBIDDEN'
      err.status = 403
    } else {
      node.destroy()
    }

    process.nextTick(() => callback(err))
  }

  // obsolete, moved to xfile
  cpfile (src, dst, policy, callback) {
    src.drive = this.src.drive
    dst.drive = this.dst.drive
    this.vfs.CPFILE(this.user, { src, dst, policy }, callback)
  }

  mvdir (src, dst, policy, callback) {
    src.drive = this.srcDriveUUID
    dst.drive = this.dstDriveUUID
    
    if (this.user) {
      this.ctx.mvdir2(this.user, src, dst, policy, callback)
    } else {
      this.ctx.mvdir(src, dst, policy, callback)
    } 
  }

  mvfile (src, dst, policy, callback) {
    src.drive = this.srcDriveUUID
    dst.drive = this.dstDriveUUID

    if (this.user) {
      this.ctx.mvfile2(this.user, src, dst, policy, callback)
    } else {
      this.ctx.mvfile(src, dst, policy, callback)
    }
  }

  genTmpPath () {
    return this.ctx.genTmpPath()
  }

  mkdir (dst, policy, callback) {
    dst.drive = this.dstDriveUUID

    if (this.user) {
      this.ctx.mkdir2(this.user, dst, policy, callback)
    } else {
      this.ctx.mkdir(dst, policy, callback)
    }
  }

  mkfile (tmp, dst, policy, callback) {
    dst.drive = this.dstDriveUUID

    if (this.user) {
      this.ctx.mkfile(this.user, tmp, dst, policy, callback)
    } else {
      this.ctx.mkfile(tmp, dst, policy, callback)
    }
  }

  clone (src, callback) {
    src.drive = this.srcDriveUUID

    if (this.user) {
      this.ctx.clone(this.user, src, callback)
    } else {
      this.ctx.clone(src, callback)
    }
  }
}

/**
class Move extends Base {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies, src, dst, xstats)
    this.mode = 'move'
    this.srcDriveUUID = src.drive
    this.dstDriveUUID = dst.drive
    let _src = { uuid: src.dir }
    let _dst = { uuid: dst.dir }
    this.root = new DirMove(this, null, _src, _dst, xstats)
  }

}

class Import extends Base {

  constructor (ctx, user, policies, src, dst, stats) {
    super(ctx, user, policies, src, dst, stats)
    this.mode = 'import'
    this.srcPath = src.path
    this.dstDriveUUID = dst.drive
    let _src = { 
      uuid: UUID.v4(),
      name: '',
      path: src.path
    }

    let _dst = { 
      uuid: dst.dir,
      name: ''
    } 

    this.root = new DirImport(this, null, _src, _dst, stats)
  }

}

class Export extends Base {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies, src, dst, xstats)
    this.mode = 'export'
    this.srcDriveUUID = src.drive
    this.dstPath = dst.path

    let _src = {
      uuid: src.dir,
      name: '',
    }

    let _dst = {
      path: dst.path
    }

    this.root = new DirExport(this, null, _src, _dst, xstats)
  }

}
**/

module.exports = XCopy
