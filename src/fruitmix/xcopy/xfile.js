const fs = require('fs')

const rimraf = require('rimraf')
const debug = require('debug')('xfile')

const XNode = require('./xnode')
const FingerStream = require('../../lib/finger-stream')

class State {
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.enter(...args)

    debug(`${this.ctx.src.name} entered ${this.constructor.name}`)

    this.ctx.ctx.reqSched()
    this.ctx.emit('StateEntered', this.constructor.name)
  }

  isDestroyed () {
    return this.ctx.isDestroyed()
  }

  getPolicy () {
    return this.ctx.getPolicy()
  }

  enter () {}
  exit () {}

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
}

class Working extends State {
  enter () {
    let task = this.ctx.ctx
    let { nfs, vfs, user, type } = task
    let policy = this.getPolicy()
    let srcDrive = task.src.drive
    let dstDrive = task.dst.drive
    let uuid = this.ctx.src.uuid
    let name = this.ctx.src.name
    let pdir = this.ctx.parent

    if (type === 'copy' || type === 'move') {
      let src = { drive: srcDrive, dir: pdir.src.uuid, uuid, name }
      let dst = { drive: dstDrive, dir: pdir.dst.uuid }
      const f = type === 'copy' ? vfs.CPFILE.bind(vfs) : vfs.MVFILE.bind(vfs)
      f(user, { src, dst, policy }, (err, xstat, resolved) => {
        if (this.isDestroyed()) return
        if (err && err.code === 'EEXIST') {
          this.tryConflict(err, policy)
        } else if (err) {
          this.setState(Failed, err)
        } else {
          this.setState(Finish)
        }
      })
    } else if (type === 'icopy' || type === 'imove') {
      let props = { id: srcDrive, path: this.ctx.namepath() }
      nfs.GET(user, props, (err, srcPath) => {
        if (this.isDestroyed()) return
        if (err) {
          this.setState(Failed, err)
        } else {
          let dstPath = vfs.TMPFILE()
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
              name,
              data: dstPath,
              size: this.ws.bytesWritten,
              sha256: this.fs.fingerprint,
              policy
            }

            vfs.NEWFILE(user, props, (err, stat, resolved) => {
              if (this.isDestroyed()) return
              if (err && err.code === 'EEXIST') {
                this.tryConflict(err, policy)
              } else if (err) {
                this.setState(Failed, err)
              } else { // TODO rimraf file ???
                if (type === 'imove') {
                  if (this.isSkipped(policy, resolved)) {
                    this.setState(Finish)
                  } else {
                    let props = { id: srcDrive, path: this.ctx.namepath() }
                    nfs.DELETE(user, props, () => this.setState(Finish))
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
      let props = { driveUUID: srcDrive, dirUUID: pdir.src.uuid, uuid, name }
      vfs.CLONE(user, props, (err, data) => {
        if (this.isDestroyed()) return
        if (err) {
          this.setState(Failed, err)
        } else {
          let props = { id: dstDrive, path: pdir.dstNamePath(), name, data, policy }
          nfs.NEWFILE(user, props, (err, _, resolved) => {
            if (this.isDestroyed()) return
            rimraf(data, () => {})
            if (err && err.code === 'EEXIST') {
              this.tryConflict(err, policy)
            } else if (err) {
              this.setState(Failed, err)
            } else if (this.isSkipped(policy, resolved)) {
              this.setState(Finish)
            } else {
              if (type === 'emove') {
                let props = { driveUUID: srcDrive, dirUUID: pdir.src.uuid, uuid, name }
                // ignore error if any
                vfs.REMOVE(user, props, () => this.setState(Finish))
              } else {
                this.setState(Finish)
              }
            }
          })
        }
      })
    } else if (type === 'ncopy' || type === 'nmove') {
      if (type === 'nmove' && srcDrive === dstDrive) { // by rename
        let props = { id: srcDrive, srcPath: pdir.namepath(), dstPath: pdir.dstNamePath(), name, policy }
        nfs.MVFILE(user, props, (err, _, resolved) => {
          if (this.isDestroyed()) return
          if (err && err.code === 'EEXIST') {
            this.tryConflict(err, policy)
          } else if (err) {
            this.setState(Failed, err)
          } else {
            this.setState(Finish)
          }
        })
      } else { // by copy + optional remove
        let src = { drive: srcDrive, dir: pdir.namepath(), name }
        let dst = { drive: dstDrive, dir: pdir.dstNamePath() }
        nfs.CPFILE(user, { src, dst, policy }, (err, streams, resolved) => {
          if (this.isDestroyed()) return
          if (err && err.code === 'EEXIST') {
            this.tryConflict(err, policy)
          } else if (err) {
            this.setState(Failed, err)
          } else if (this.isSkipped(policy, resolved)) {
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
                nfs.DELETE(user, props, () => this.setState(Finish))
              } else {
                this.setState(Finish)
              }
            })
            rs.pipe(ws)
          }
        })
      }
    } else {
      let err = new Error(`invalid task type ${type}`)
      this.setState(Failed, err)
    }
  }

  isSkipped (p, r) {
    return ((p[0] === 'skip' && r[0]) || (p[1] === 'skip' && r[1]))
  }

  // err.code must be EEXIST
  tryConflict (err, policy) {
    let p = this.getPolicy()
    if (p[0] === policy[0] && p[1] === policy[1]) {
      this.setState(Conflict, err, policy)
    } else {
      this.setState(Working)
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

  updatePolicy (policy) {
    if (policy) {
      let p = this.ctx.policy
      p[0] = policy[0] || p[0]
      p[1] = policy[1] || p[1]
    }
    this.setState(Working)
  }
}

class Failed extends State {
  enter (err) {
    if (process.env.LOGE) console.log('xfile failed', err)
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
    Object.defineProperty(this, 'type', { value: 'file', writable: false })
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
}

module.exports = XFile
