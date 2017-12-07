const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

const { openwx } = require('./lib')
const Node = require('./node')

class State {

  constructor(file, ...args) {
    this.file = file
    file.state = this
    this.enter(...args)
  }

  destroy () {
    this.exit()
  }

  setState (state, ...args) {
    this.exit()
    let NextState = this.file[state]
    new NextState(this.file, ...args)
  }

  retry () {
  }

  enter () {
  }

  exit () {
  }
}

class Pending extends State {

  enter () {
    this.file.ctx.indexPendingFile(this.file)
  }

  exit () {
    this.file.ctx.unindexPendingFile(this.file)
  }

}

// Working state is overridden by each File derivatives
class Working extends State {

  enter () {
    this.file.ctx.indexWorkingFile(this.file)
  }

  exit () {
    this.file.ctx.unindexWorkingFile(this.file)
  }

}

class CopyWorking extends Working {

  enter () {
    super.enter()

    let src = {
      dir: this.file.parent.srcUUID,
      uuid: this.file.srcUUID,
      name: this.file.srcName,
    }

    let dst = {
      dir: this.file.parent.dstUUID
    }

    let policy = this.file.getPolicy()

    this.file.ctx.cpfile(src, dst, policy, (err, xstat, resolved) => {
      // the following setState works for they are not overridden
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.setState('Finished')
      }
    }) 
  }

}

class MoveWorking extends Working {

  enter () {
    super.enter()

    let src = {
      dir: this.file.parent.srcUUID,
      uuid: this.file.srcUUID,
      name: this.file.srcName,
    }

    let dst = {
      dir: this.file.parent.dstUUID
    }

    let policy = this.file.getPolicy()

    this.file.ctx.mvfile(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setStaate('Failed', err)
      } else {
        this.setState('Finished')
      }
    })
  }

}

class ImportWorking extends Working {

  enter () {
    super.enter()

    let tmpPath = this.file.ctx.genTmpPath()  
    fs.open(this.file.srcPath, 'r', (err, fd) => {
      if (err) {
        // TODO
      } else {
        this.rs = fs.createReadStream(null, { fd })
        this.ws = fs.createWriteStream(tmpPath)
        this.rs.pipe(this.ws)
        this.ws.on('finish', () => {
       
          let tmp = { path: tmpPath }
          let dst = { 
            dir: this.file.parent.dstUUID,
            name: this.file.srcName
          }

          let policy = this.file.getPolicy()

          this.file.ctx.mkfile(tmp, dst, policy, (err, xstat, resolved) => {
            if (err && err.code === 'EEXIST') {
              this.setState('Conflict', err, policy)
            } else if (err) {
              this.setState('Failed', err)
            } else {
              rimraf(tmpPath, () => {})
              this.setState('Finished')
            }
          })
        })
      }
    })
  }
}

class ExportWorking extends Working {

  enter () {
    super.enter()

    let src = {
      dir: this.file.parent.srcUUID,
      uuid: this.file.srcUUID,
      name: this.file.srcName
    }

    this.file.ctx.clone(src, (err, tmpPath) => {
      if (err) {
        this.setState('Failed', err)
      } else {
        let dstFilePath = path.join(this.file.parent.dstPath, this.file.srcName)
        let policy = this.file.getPolicy()

        openwx(dstFilePath, policy, (err, fd) => {
          if (err) {
            rimraf(tmpPath, () => {})
            this.setState('Failed', err) 
          } else {
            this.rs = fs.createReadStream(tmpPath) 
            this.ws = fs.createWriteStream(null, { fd })
            this.rs.pipe(this.ws)

            this.ws.on('finish', () => {
              rimraf(tmpPath, () => {})
              this.setState('Finished')
            })
          }
        })
      }
    })
  }
}

class Conflict extends State {

  enter () {
    this.file.ctx.indexConflictFile(this.file)
  }

  retry () {
    this.setState('Working')
  }

  exit () {
    this.file.ctx.unindexConflictFile(this.file)
  }

}

class Failed extends State {

  enter (e) {
    this.file.ctx.indexFailedFile(this.file)
    console.log(e, e.stack)
    this.file.emit('error', e)
  }

  exit () {
    this.file.ctx.unindexFailedFile(this.file)
  }

}

class Finished extends State {

  enter () {
    this.file.ctx.indexFinishedFile(this.file)
    this.file.emit('finish')
  }

  exit () {
    this.file.ctx.unindexFinishedFile(this.file)
  }

}

class File extends Node {

  destroy (detach) {
    this.state.destroy()
    super.destroy(detach)
  }

  setState (state) {
    this.state.setState(state)
  }

  view () {
    let obj = {
      type: 'directory',
      parent: this.parent && this.parent.srcUUID,
      srcUUID: this.srcUUID
    }

    if (this.dstUUID) obj.dstUUID = this.dstUUID
    obj.state = this.state.constructor.name
    if (this.policy) obj.policy = this.policy
    return obj
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.file[0] || null,
      this.policy[1] || this.ctx.policies.file[1] || null
    ]  
  }

  setPolicy (type, policy) {
    let index = type === 'same' ? 0 : 1
    this.policy[index] = policy
    this.retry()
  }

  retry () {
    // FIXME !!!
    this.state.retry() 
  }  
}

File.prototype.Pending = Pending
File.prototype.Working = Working      // <- this will be overridden
File.prototype.Conflict = Conflict
File.prototype.Finished = Finished
File.prototype.Failed = Failed

class CopyFile extends File {

  constructor(ctx, parent, srcUUID, srcName) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
    this.state = new Pending(this)
  }

}

CopyFile.prototype.Working = CopyWorking

class MoveFile extends File {

  constructor(ctx, parent, srcUUID, srcName) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
    this.state = new Pending(this)
  }

}

MoveFile.prototype.Working = MoveWorking

class ImportFile extends File {

  constructor(ctx, parent, srcPath) {
    super(ctx, parent)
    this.srcPath = srcPath
    this.srcName = path.basename(srcPath)
    this.state = new Pending(this)
  }

}

ImportFile.prototype.Working = ImportWorking

class ExportFile extends File {

  constructor(ctx, parent, srcUUID, srcName) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
    this.state = new Pending(this)
  }

}

ExportFile.prototype.Working = ExportWorking

module.exports = {
  File,
  CopyFile,
  MoveFile,
  ImportFile,
  ExportFile,
}


