const EventEmitter = require('events')

const UUID = require('uuid')
const debug = require('debug')('xcopy')

const XDir = require('./xdir')

const verbose = !!process.env.VERBOSE

/**
This is a container of a collection of sub-tasks, organized in a tree.
*/
class XCopy extends EventEmitter {
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

    // backward compatible for a few weeks
    if (type === 'import') type = 'icopy'
    if (type === 'export') type = 'ecopy'

    this.type = type
    this.user = user
    this.uuid = UUID.v4()
    this.autoClean = props.autoClean

    this.src = src
    this.dst = dst
    this.entries = entries
    this.policies = policies

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
        process.nextTick(() => this.emit('finish'))
      }
    })

    this.root = root
  }

  destroy () {
    if (this.root) this.root.destroy()
    this.root = null
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
      if (node.type === 'directory' && node.stateName() === 'Parent') {
        node.children.forEach(c => {
          if (c.type === 'file') {
            let state = c.stateName()
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
            let state = c.stateName()
            if (state === 'Mkdir' || state === 'Preparing' || state === 'Finishing') {
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
      let state = this.root.stateName()
      if (state === 'Preparing') {
        runningDir++
      } else if (state === 'Parent') {
        this.root.visit(F)
      } else {
        throw new Error(`root is in ${state} state, expected Preparing or Parent`)
      }
    }
    
    if (verbose) debug({ runningFile, conflictFile, runningDir, conflictDir })
    return { runningFile, conflictFile, runningDir, conflictDir }
  }

  sched () {
    if (verbose) debug('sched')

    if (!this.root) {
      if (this.watchCallback) {
        debug('<< watch callback returns after finished')
        this.watchCallback(null, this.view())
        this.watchCallback = null
      }
      return
    }

    this.scheduled = false

    let { runningFile, runningDir } = this.count()

    if (runningFile >= this.fileLimit && runningDir >= this.dirLimit) return

    const schedF = node => {
      if (node.type === 'directory' && node.stateName() === 'Parent') {
        runningFile += node.createSubFile(this.fileLimit - runningFile)
        runningDir += node.createSubDir(this.dirLimit - runningDir)
      }

      if (runningFile >= this.fileLimit && runningDir >= this.dirLimit) return true
    }

    this.root.visit(schedF)

    if (this.watchCallback) {
      let { runningFile, runningDir } = this.count()
      if (runningFile === 0 && runningDir === 0) {
        debug('<< watch callback returns')
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
    if (verbose) debug('req sched')

    if (this.stepping) {
      if (this.scheduled) return

      this.scheduled = true
      process.nextTick(() => {
        this.scheduled = false
        if (this.steppingState !== 'Stepping') {
          console.log('ERROR: reqSched called @ Stopped state in stepping mode')
        } else {
          let { runningFile, runningDir } = this.count()
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
    debug('>> watch')
    // if (!this.stepping) return process.nextTick(() => callback(null))
    if (this.watchCallback) return process.nextTick(() => callback(null))

    let { runningFile, runningDir } = this.count()
    if (runningFile === 0 && runningDir === 0) {
      process.nextTick(() => callback(null, this.view()))
    } else {
      this.watchCallback = callback
    }
  }

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
        let { runningFile, runningDir } = this.count()
        this.root.visit(n => {
          if (runningFile || runningDir) {
            if (n.stateName() !== 'Conflict') {
              nodes.push(n.view())
            }
          } else {
            if (n.stateName() === 'Conflict') {
              nodes.push(n.view())
            }
          }
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

  updateNode (nodeUUID, props, callback) {
    if (!this.root) {
      let err = new Error('node not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let { policy } = props
    let node = this.root.find(n => n.src.uuid === nodeUUID)

    // node not exist
    if (!node) {
      let err = new Error('node not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    // node not conflicting
    if (node.stateName() !== 'Conflict') {
      let err = new Error('invalid operation')
      err.status = 403
      return process.nextTick(() => callback(err))
    }

    // policy not array
    if (!policy || !Array.isArray(policy)) {
      let err = new Error('policy should be array')
      err.status = 400
      return process.nextTick(() => callback(err))
    }

    // keep can only be same for dir
    if (policy[1] === 'keep' || (policy[0] === 'keep' && node.type === 'file')) {
      let err = new Error('keep can only be used as same policy for dir')
      err.status = 400
      return process.nextTick(() => callback(err))
    }

    // In stepping mode, update node is kicking the step machine
    if (this.stepping && this.steppingState === 'Stopped') {
      this.steppingState = 'Stepping'
    }

    debug(`update ${node.src.name} with`, policy)

    node.updatePolicy(props.policy)

    if (props.applyToAll === true) {
      let name = node.type === 'file' ? 'file' : 'dir'
      this.policies[name][0] = policy[0] || this.policies[name][0]
      this.policies[name][1] = policy[1] || this.policies[name][1]
      this.root.visit(n => n.type === node.type && n.updatePolicy())
    }

    process.nextTick(() => callback(null, this.view()))
  }
}

module.exports = XCopy
