const fs = require('fs')

const rimraf = require('rimraf')
const debug = require('debug')('xfile')

const XNode = require('./xnode')
const FingerStream = require('../../lib/finger-stream')

/**
Base state class for file
*/
class State {
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.mode = this.ctx.mode
    this.destroyed = false
    this.enter(...args)
    let state = this.constructor.name
    debug(`${this.ctx.src.name} entered ${state}`)
    this.ctx.ctx.reqSched()
    this.ctx.emit('StateEntered', state)
  }

  isDestroyed () {
    return this.ctx.isDestroyed()
  }

  enter () {}
  exit () {}

  getState () {
    return this.constructor.name
  }

  setState (State, ...args) {
    this.exit()
    this.ctx.state = new State(this.ctx, ...args)
  }

  destroy () {
    this.exit()
    this.destroyed = true
  }

  policyUpdated () {
  }

  view () {
  }
}

class Working extends State {
  enter () {
    let task = this.ctx.ctx
    let { nfs, vfs } = task
    let user = this.ctx.ctx.user
    let type = this.ctx.ctx.type
    let policy = this.ctx.getPolicy()

    let pdir = this.ctx.parent  
 
    let srcDrive = task.src.drive
    let dstDrive = task.dst.drive

    if (type === 'copy' || type === 'move') {
      let src = {
        drive: srcDrive,
        dir: pdir.src.uuid,
        uuid: this.ctx.src.uuid,
        name: this.ctx.src.name
      }

      let dst = {
        drive: dstDrive,
        dir: pdir.dst.uuid
      }

      const f = type === 'copy' ? vfs.CPFILE.bind(vfs) : vfs.MVFILE.bind(vfs)
      f(user, { src, dst, policy }, (err, xstat, resolved) => {
        if (this.isDestroyed()) return
        if (err && err.code === 'EEXIST') {
          this.setState(Conflict, err, policy)
        } else if (err) {
          this.setState(Failed, err)
        } else {
          this.setState(Finish)
        }
      })
    } else if (type === 'icopy' || type === 'imove') {
      let props = {
        id: srcDrive,
        path: this.ctx.namepath()
      }

      this.ctx.ctx.nfs.GET(user, props, (err, srcPath) => {
        if (this.isDestroyed()) return
        if (err) {
          this.setState(Failed, err)
        } else {
          let dstPath = this.ctx.ctx.vfs.TMPFILE()

          this.rs = fs.createReadStream(srcPath)
          this.fs = new FingerStream()
          this.ws = fs.createWriteStream(dstPath)

          let fingerFinished = false
          let writeStreamFinished = false

          const finish = () => {
            if (!fingerFinished || !writeStreamFinished) return

            let props = {
              driveUUID: dstDrive,
              dirUUID: pdir.dst.uuid,
              name: this.ctx.src.name,
              data: dstPath,
              size: this.ws.bytesWritten,
              sha256: this.fs.fingerprint,
              policy
            }

            this.ctx.ctx.vfs.NEWFILE(user, props, (err, stat, resolved) => {
              if (this.isDestroyed()) return
              if (err && err.code === 'EEXIST') {
                this.setState(Conflict, err, policy)
              } else if (err) {
                this.setState(Failed, err)
              } else { // TODO rimraf file
                if (type === 'imove') {
                  if ((policy[0] === 'skip' && resolved[0]) || (policy[1] === 'skip' && resolved[1])) {
                    this.setState(Finish)
                  } else {
                    let props = { id: srcDrive, path: this.ctx.namepath() }
                    this.ctx.ctx.nfs.DELETE(user, props, () => this.setState(Finish))
                  }
                } else {
                  this.setState(Finish)
                }
              }
            })
          }

          this.fs.on('finish', () => {
            fingerFinished = true
            process.nextTick(finish)
          })

          this.ws.on('finish', () => {
            writeStreamFinished = true
            process.nextTick(finish)
          })

          this.rs.pipe(this.ws)
          this.rs.pipe(this.fs)
        }
      })
    } else if (type === 'ecopy' || type === 'emove') {
      // src props
      let props = {
        driveUUID: srcDrive,
        dirUUID: pdir.src.uuid,
        uuid: this.ctx.src.uuid,
        name: this.ctx.src.name
      }

      // clone src
      this.ctx.ctx.vfs.CLONE(user, props, (err, data) => {
        if (this.isDestroyed()) return
        if (err) {
          this.setState(Failed, err)
        } else {
          let props = {
            id: dstDrive,
            path: pdir.dstNamePath(), // dir path
            name: this.ctx.src.name,
            data,
            policy
          }

          this.ctx.ctx.nfs.NEWFILE(user, props, (err, _, resolved) => {
            if (this.isDestroyed()) return
            rimraf(data, () => {})
            if (err && err.code === 'EEXIST') {
              this.setState(Conflict, err, policy)
            } else if (err) {
              this.setState(Failed, err)
            } else if ((policy[0] === 'skip' && resolved[0]) 
              || (policy[1] === 'skip' && resolved[1])) {
              this.setState(Finish)
            } else {
              if (type === 'emove') {
                let props = {
                  driveUUID: srcDrive,
                  dirUUID: pdir.src.uuid,
                  uuid: this.ctx.src.uuid,
                  name: this.ctx.src.name 
                }

                // ignore error if any
                this.ctx.ctx.vfs.REMOVE(user, props, () => this.setState(Finish))
              } else {
                this.setState(Finish)
              }
            }
          })
        }
      })
    } else if (type === 'ncopy' || type === 'nmove') {
      if (type === 'nmove' && srcDrive === dstDrive) { // by rename
        let props = {
          id: srcDrive,
          srcPath: pdir.namepath(),
          dstPath: pdir.dstNamePath(),
          name: this.ctx.src.name,
          policy
        }

        this.ctx.ctx.nfs.MVFILE(user, props, (err, _, resolved) => {
          if (this.isDestroyed()) return
          if (err && err.code === 'EEXIST') {
            this.setState(Conflict, err, policy)
          } else if (err) {
            this.setState(Failed, err)
          } else {
            this.setState(Finish)
          }
        })
      } else { // by copy + optional remove
        let src = {
          drive: srcDrive,
          dir: pdir.namepath(),
          name: this.ctx.src.name 
        }
        let dst = {
          drive: dstDrive,
          dir: pdir.dstNamePath(),
        }

        this.ctx.ctx.nfs.CPFILE(user, { src, dst, policy }, (err, streams, resolved) => {
          if (this.isDestroyed()) return
          if (err && err.code === 'EEXIST') {
            this.setState(Conflict, err, policy)
          } else if (err) {
            this.setState(Failed, err)
          } else if ((policy[0] === 'skip' && resolved[0]) || (policy[1] === 'skip' && resolved[1])) {
            this.setState(Finish)
          } else {
            let { rs, ws } = streams

            const error = err => {
              rs.removeListener('error', error)
              rs.on('error', () => {})
              ws.removeListener('error', error)
              ws.removeAllListeners('finish')
              ws.on('error', () => {})
              rs.unpipe(ws)
              this.setState(Failed, err)
            }

            rs.on('error', error)
            ws.on('error', error)
            ws.on('finish', () => {
              if (type === 'nmove') {
                let props = { id: srcDrive, path: this.ctx.namepath() } 
                // ignore error
                this.ctx.ctx.nfs.DELETE(user, props, () => this.setState(Finish))
              } else {
                this.setState(Finish)  
              }
            })
            rs.pipe(ws)
          }
        })
      }
    } else {
      throw new Error('invalid task type') // TODO
    }
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

  policyUpdated () {
    this.setState(Working)
  }
}

class Failed extends State {
  enter (err) {
    if (process.env.LOGE) debug(err)
    this.error = err
  }
}

class Finish extends State {}


class XFile extends XNode {
  /**
  @param {object} ctx - task context
  @param {object} parent - parent node, must be an XDir
  @param {object} src
  @param {object} [src.uuid] - only required for vfs source
  @param {ojbect} src.name - required for both vfs and nfs source
  */
  constructor (ctx, parent, src) {
    super(ctx, parent)
    Object.defineProperty(this, 'type', { get () { return 'file' } })
    this.src = src
    this.policy = [null, null]
    this.state = new Working(this)
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.file[0] || null,
      this.policy[1] || this.ctx.policies.file[1] || null
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
}

module.exports = XFile
