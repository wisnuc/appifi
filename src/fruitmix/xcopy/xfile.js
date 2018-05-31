const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')
const debug = require('debug')('xfile')

const Node = require('./node')
const openwx = require('./lib').openwx
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
    switch (this.ctx.ctx.type) {
      case 'copy': {
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
        this.ctx.ctx.vfs.CPFILE(this.ctx.ctx.user, { src, dst, policy }, (err, xstat, resolved) => {
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
      } break

      case 'move': {
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
        this.ctx.ctx.vfs.MVFILE(this.ctx.ctx.user, { src, dst, policy }, (err, xstat, resolved) => {
          if (this.destroyed) return
          if (err && err.code === 'EEXIST') {
            this.setState(Conflict, err, policy)
          } else if (err) {
            this.setState(Failed, err)
          } else {
            this.setState(Finish)
          }
        })

      } break

      case 'import': {

        // TODO 1. refactor hash to child process
        // TODO 2. remove tmp file ???

        let props = {
          id: this.ctx.ctx.src.drive,
          path: this.ctx.namepath(),
        }

        this.ctx.ctx.nfs.GET(this.ctx.ctx.user, props, (err, srcPath) => {
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
                policy,
              }

              this.ctx.ctx.vfs.NEWFILE(user, props, (err, stat, resolved) => {
                if (err && err.code === 'EEXIST') {
                  this.setState(Conflict, err, policy)
                } else if (err) {
                  this.setState(Failed, err)
                } else {
                  this.setState(Finish)
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
      } break

      case 'export': {
        let src = {
          dir: this.ctx.parent.src.uuid,
          uuid: this.ctx.src.uuid,
          name: this.ctx.src.name
        }

        this.ctx.ctx.clone(src, (err, tmpPath) => {
          if (err) {
            this.setState('Failed', err)
          } else {
            let dstFilePath = path.join(this.ctx.parent.dst.path, this.ctx.src.name)
            let policy = this.ctx.getPolicy()

            openwx(dstFilePath, policy, (err, fd, resolved) => {
              if (err && err.code === 'EEXIST') {
                rimraf(tmpPath, () => {})
                this.setState(Conflict, err, policy)
              } else if (err) {
                rimraf(tmpPath, () => {})
                this.setState(Failed, err)
              } else {
                if (fd) {
                  this.rs = fs.createReadStream(tmpPath)
                  this.fs = new FingerStream()
                  this.ws = fs.createWriteStream(null, { fd })
                  this.rs.pipe(this.fs)
                  this.rs.pipe(this.ws)

                  this.ws.on('finish', () => {
                    rimraf(tmpPath, () => {})

                    console.log(this.fs.fingerprint)

                    this.setState(Finish)
                  })
                } else {
                  this.setState(Finish)
                }
              }
            })
          }
        })
      } break

      default:
        throw new Error('invalid mode') // TODO
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
        xcode: this.err.xcode,
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
The base class of a file subtask

@memberof XCopy
*/
class XFile extends Node {

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
