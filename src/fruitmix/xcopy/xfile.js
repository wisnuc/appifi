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
    let user = this.ctx.ctx.user
    let type = this.ctx.ctx.type

    if (type === 'copy') {
      let src = {
        drive: this.ctx.ctx.src.drive,
        dir: this.ctx.parent.src.uuid,
        uuid: this.ctx.src.uuid,
        name: this.ctx.src.name
      }

      let dst = {
        drive: this.ctx.ctx.dst.drive,
        dir: this.ctx.parent.dst.uuid
      }

      let policy = this.ctx.getPolicy()
      this.ctx.ctx.vfs.CPFILE(user, { src, dst, policy }, (err, xstat, resolved) => {
        if (this.destroyed) return
        if (err && err.code === 'EEXIST') {
          // TODO detect policy change and retry
          this.setState(Conflict, err, policy)
        } else if (err) {
          this.setState(Failed, err)
        } else {
          this.setState(Finish)
        }
      })
    } else if (type === 'move') {
      let src = {
        drive: this.ctx.ctx.src.drive,
        dir: this.ctx.parent.src.uuid,
        uuid: this.ctx.src.uuid,
        name: this.ctx.src.name
      }

      let dst = {
        drive: this.ctx.ctx.dst.drive,
        dir: this.ctx.parent.dst.uuid
      }

      let policy = this.ctx.getPolicy()
      this.ctx.ctx.vfs.MVFILE(user, { src, dst, policy }, (err, xstat, resolved) => {
        if (this.destroyed) return
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
        id: this.ctx.ctx.src.drive,
        path: this.ctx.namepath()
      }

      this.ctx.ctx.nfs.GET(user, props, (err, srcPath) => {
        if (this.destroyed) return
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

            let policy = this.ctx.getPolicy()
            let user = this.ctx.ctx.user
            let props = {
              driveUUID: this.ctx.ctx.dst.drive,
              dirUUID: this.ctx.parent.dst.uuid,
              name: this.ctx.src.name,
              data: dstPath,
              size: this.ws.bytesWritten,
              sha256: this.fs.fingerprint,
              policy
            }

            this.ctx.ctx.vfs.NEWFILE(user, props, (err, stat, resolved) => {
              if (err && err.code === 'EEXIST') {
                this.setState(Conflict, err, policy)
              } else if (err) {
                this.setState(Failed, err)
              } else {
                // TODO rimraf file
               
                if (type === 'imove') {
                  let user = this.ctx.ctx.user                 
                  let props = {
                    id: this.ctx.ctx.src.drive,
                    path: this.ctx.namepath()
                  }

                  // ignore error
                  this.ctx.ctx.nfs.DELETE(user, props, () => this.setState(Finish))
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
        driveUUID: this.ctx.ctx.src.drive,
        dirUUID: this.ctx.parent.src.uuid,
        uuid: this.ctx.src.uuid,
        name: this.ctx.src.name
      }

      // clone src
      this.ctx.ctx.vfs.CLONE(user, props, (err, data) => {
        if (err) {
          this.setState(Failed, err)
        } else {
          let policy = this.ctx.getPolicy()
          let props = {
            id: this.ctx.ctx.dst.drive,
            path: this.ctx.parent.dstNamePath(), // dir path
            name: this.ctx.src.name,
            data,
            policy
          }

          this.ctx.ctx.nfs.NEWFILE(user, props, (err, _, resolved) => {
            rimraf(data, () => {})
            if (err && err.code === 'EEXIST') {
              this.setState(Conflict, err, policy)
            } else if (err) {
              this.setState(Failed, err)
            } else {
              if (type === 'emove') {
                let props = {
                  driveUUID: this.ctx.ctx.src.drive,
                  dirUUID: this.ctx.parent.src.uuid,
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
      if (type === 'nmove' && this.ctx.ctx.src.drive === this.ctx.ctx.dst.drive) { // by rename
        let user = this.ctx.ctx.user
        let policy = this.ctx.getPolicy()
        let props = {
          id: this.ctx.ctx.src.drive,
          srcPath: this.ctx.parent.namepath(),
          dstPath: this.ctx.parent.dstNamePath(),
          name: this.ctx.src.name,
          policy
        }

        this.ctx.ctx.nfs.MVFILE(user, props, (err, _, resolved) => {
          if (err && err.code === 'EEXIST') {
            this.setState(Conflict, err, policy)
          } else if (err) {
            this.setState(Failed, err)
          } else {
            this.setState(Finish)
          }
        })
      } else { // by copy + optional remove
        let user = this.ctx.ctx.user
        let policy = this.ctx.getPolicy()
        let src = {
          drive: this.ctx.ctx.src.drive,
          dir: this.ctx.parent.namepath(),
          name: this.ctx.src.name 
        }
        let dst = {
          drive: this.ctx.ctx.dst.drive,
          dir: this.ctx.parent.dstNamePath(),
        }

        this.ctx.ctx.nfs.CPFILE(user, { src, dst, policy }, (err, streams, resolved) => {
          if (err && err.code === 'EEXIST') {
            this.setState(Conflict, err, policy)
          } else if (err) {
            this.setState(Failed, err)
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
                let props = {
                  id: this.ctx.ctx.src.drive,
                  path: this.ctx.namepath()
                } 
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
  enter (e) {
    this.error = e
  }
}

class Finish extends State { }

/**
The base class of a file subtask in xcopy
*/
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
    this.src = src
    this.policy = [null, null]
    this.state = new Working(this)
  }

  get type () {
    return 'file'
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
