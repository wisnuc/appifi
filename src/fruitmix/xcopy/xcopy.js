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

    if (!vfs) throw new Error('vfs is not provided')
    if (!nfs) throw new Error('nfs is not provided')

    this.finished = false

    this.dirLimit = props.dirLimit || 4
    this.fileLimit = props.fileLimit || 2

    let { type, src, dst, entries, policies, stepping } = props

    this.vfs = vfs
    this.nfs = nfs

    this.stepping = !!stepping

    // stepping mode specific
    this.steppingState = 'Stopped' // or 'Stepping'

    // backward compatible for a few weeks TODO
    if (type === 'import') type === 'icopy'
    if (type === 'export') type === 'ecopy'

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
    } else if (this.type === 'icopy' || this.type === 'imove') {
      src = { uuid: UUID.v4(), name: this.src.dir }
      dst = { uuid: this.dst.dir, name: '' }
    } else if (this.type === 'ecopy' || this.type === 'emove') {
      src = { uuid: this.src.dir, name: '' }
      dst = { name: this.dst.dir }
    } else if (this.type === 'ncopy' || this.type === 'nmove') {
      src = { uuid: UUID.v4(), name: this.src.dir }
      dst = { name: this.dst.dir }
    } else {
      throw new Error('unexpected type')
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
    if (this.root) this.root.destroy()
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
    debug({ runningFile, conflictFile, runningDir, conflictDir })
    return { runningFile, conflictFile, runningDir, conflictDir }
  }

  /** 
  
  */
  sched () {
    debug('sched')

    if (!this.root) {
      if (this.watchCallback) {
        this.watchCallback(null, this.view())
        this.watchCallback = null
      }
      return
    }

    this.scheduled = false

    let { runningFile, conflictFile, runningDir, conflictDir } = this.count() 

    if (runningFile >= this.fileLimit && runningDir >= this.dirLimit) return

    const schedF = node => {
      if (node.constructor.name === 'XDir' && node.state.constructor.name === 'Parent') {
        runningFile += node.createSubFile(this.fileLimit - runningFile)
        runningDir += node.createSubDir(this.dirLimit - runningDir)
      }

      // 判断是否需要继续visit
      if (runningFile >= this.fileLimit && runningDir >= this.dirLimit) return true
    } 

    try {
      this.root.visit(schedF)
    } catch (e) {
      console.log(e)
    }

    if (this.watchCallback) {
      let { runningFile, runningDir } = this.count()
      if (runningFile === 0 && runningDir === 0) {
        this.watchCallback(null, this.view())
        this.watchCallback = null
      }
    }
  }

  // this function is called internally from sub tasks
  // in stepping mode, this function is responsible for transition from Stepping to Stopped state
  // any watch callback should be returned if transition occurred
  // in non-stepping mode, this function schedule sched
  reqSched () {
    debug('req sched')

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
    debug('watch')
    // if (!this.stepping) return process.nextTick(() => callback(null))
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
      type: this.type,
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

  // this method is used by copy, move and ecopy, but not icopy
  readdir(srcDirUUID, callback) {
    if (this.user) {
      this.ctx.readdir(this.user, this.srcDriveUUID, srcDirUUID, callback)
    } else {
      this.ctx.readdir(this.srcDriveUUID, srcDirUUID, callback)
    }
  }

  updateNode (nodeUUID, props, callback) {
    if (!this.root) {
      let err = new Error('node not found') 
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let { policy } = props
    let node
    this.root.visit(n => {
      if (n.src.uuid === nodeUUID) {
        node = n
        return true
      }
    })

    // 节点不存在
    if (!node) {
      let err = new Error('node not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    // 节点不处于冲突状态
    if (node.state.constructor.name !== 'Conflict') {
      let err = new Error('invalid operation')
      err.status = 403
      return process.nextTick(() => callback(err))
    }

    // policy 不为数组
    if (!policy || !Array.isArray(policy)) {
      let err = new Error('policy should be array')
      err.status = 400
      return process.nextTick(() => callback(err))
    }

    // 
    if (Array.isArray(policy) 
      && (policy[1] === 'keep' 
        || (node.constructor.name == 'XFile' && policy[0] === 'keep')
      ) ) {
      let err = new Error('file or diff policy can not be keep')
      err.status = 400
      return process.nextTick(() => callback(err))
    }

    // In stepping mode, update node is kicking the step machine
    if (this.stepping && this.steppingState === 'Stopped') {
      this.steppingState = 'Stepping'
    }

    node.updatePolicy(props.policy)

    if (props.applyToAll === true) {
      console.log(`更新Policies之前 全局文件策略 ${this.policies.file}`)
      console.log(`更新Policies之前 全局夹策略 ${this.policies.dir}`)
      let { dir, file } = this.policies

      if (node.constructor.name === 'XFile') {
        let old = [...file]
        if (policy[0]) file[0] = policy[0]
        if (policy[1]) file[1] = policy[1]
        if (file[0] !== old[0] || file[1] !== old[1])
        console.log(`更新Policies之后 全局文件策略 ${this.policies.file}`)
          this.root.visit(n => {
            if (n.src.uuid !== nodeUUID) n.policyUpdated(file)
          })
      } else {
        let old = [...dir]
        if (policy[0]) dir[0] = policy[0]
        if (policy[1]) dir[1] = policy[1]
        if (dir[0] !== old[0] || dir[1] !== old[1])
        console.log(`更新Policies之后 全局文件夹策略 ${this.policies.dir}`)
          this.root.visit(n => {
            if (n.src.uuid !== nodeUUID) n.policyUpdated(dir)
          })
      }
    }

    process.nextTick(() => callback(null, this.view()))
  }

}

module.exports = XCopy
