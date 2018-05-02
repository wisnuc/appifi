const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')

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
    this.ctx.ctx.indexFile(this.getState(), this.ctx)
  }

  enter () {}
  exit () {}

  getState () {
    return this.constructor.name
  }

  setState (State, ...args) {
    this.ctx.ctx.unindexFile(this.getState(), this.ctx)
    this.exit()
    this.ctx.state = new State(this.ctx, ...args)
  }

  destroy () {
    this.ctx.ctx.unindexFile(this.getState(), this.ctx)
    this.exit()
    this.destroyed = true
  }

  // this is a pending state specific method
  run () { }

  // this is a conflict state specific method
  updatePolicy (policy) {
  }
}

/**

*/
class Pending extends State {
  run () {
    this.setState(Working)
  }
}

class Working extends State {
  enter () {
    switch (this.ctx.mode) {
      case 'copy': {
        let src = {
          dir: this.ctx.parent.src.uuid,
          uuid: this.ctx.src.uuid,
          name: this.ctx.src.name
        }

        let dst = {
          dir: this.ctx.parent.dst.uuid
        }

        let policy = this.ctx.getPolicy()
        this.ctx.ctx.cpfile(src, dst, policy, (err, xstat, resolved) => {
          if (this.destroyed) return
          if (err && err.code === 'EEXIST') {
            this.setState(Conflict, err, policy)
          } else if (err) {
            this.setState(Failed, err)
          } else {
            this.setState(Finished)
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
            this.setState(Finished)
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
                  this.setState(Finished)
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
                    this.setState(Finished)
                  })
                } else {
                  this.setState(Finished)
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

class Finished extends State { }

/**
The base class of a file subtask

@memberof XCopy
*/
class File extends Node {
  constructor (ctx, parent, src) {
    super(ctx, parent)
    this.src = src
    this.state = new Pending(this)
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

module.exports = File
