const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')
const debug = require('debug')('xfile')

const Node = require('./node')
const openwx = require('./lib').openwx

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

  // this is a pending state specific method
  run () { }

  // this is a conflict state specific method
  updatePolicy (policy) {
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
          dir: this.ctx.parent.src.uuid,
          uuid: this.ctx.src.uuid,
          name: this.ctx.src.name
        }

        let dst = {
          dir: this.ctx.parent.dst.uuid
        }

        let policy = this.ctx.getPolicy()

        this.ctx.ctx.mvfile(src, dst, policy, (err, xstat, resolved) => {
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
        let tmpPath = this.ctx.ctx.genTmpPath()
        fs.open(this.ctx.src.path, 'r', (err, fd) => {
          if (err) {
            // TODO
          } else {
            this.rs = fs.createReadStream(null, { fd })
            this.ws = fs.createWriteStream(tmpPath)
            this.rs.pipe(this.ws)
            this.ws.on('finish', () => {
              let tmp = { path: tmpPath }
              let dst = {
                dir: this.ctx.parent.dst.uuid,
                name: this.ctx.src.name
              }

              let policy = this.ctx.getPolicy()

              this.ctx.ctx.mkfile(tmp, dst, policy, (err, xstat, resolved) => {
                if (err && err.code === 'EEXIST') {
                  this.setState(Conflict, err, policy)
                } else if (err) {
                  this.setState(Failed, err)
                } else {
                  rimraf(tmpPath, () => {})
                  this.setState(Finish)
                }
              })
            })
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
                  this.ws = fs.createWriteStream(null, { fd })
                  this.rs.pipe(this.ws)

                  this.ws.on('finish', () => {
                    rimraf(tmpPath, () => {})
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
    this.ctx.ctx.indexConflictFile(this.ctx)
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
}

module.exports = XFile
