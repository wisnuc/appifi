const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

const autoname = require('../../lib/autoname')
const Node = require('./node')

class State {

  constructor(file, ...args) {
    this.file = file
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
    let srcDirUUID = this.file.parent.srcUUID
    let dstDirUUID = this.file.parent.dstUUID
    let fileUUID = this.file.srcUUID
    let fileName = this.file.srcName
    let policy = this.file.getPolicy()

    this.file.ctx.cpFile(srcDirUUID, fileUUID, fileName, dstDirUUID, policy, (err, xstat, resolved) => {
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
    let srcDirUUID = this.file.parent.srcUUID
    let dstDirUUID = this.file.parent.dstUUID
    let fileUUID = this.file.srcUUID
    let fileName = this.file.srcName
    let policy = this.file.getPolicy()

    this.file.ctx.mvfilec(srcDirUUID, fileUUID, fileName, dstDirUUID, policy, (err, xstat, resolved) => {
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

    let tmp = this.file.ctx.genTmpPath()  
    fs.open(this.file.srcPath, 'r', (err, fd) => {
      if (err) {
        // TODO
      } else {
        this.rs = fs.createReadStream(null, { fd })
        this.ws = fs.createWriteStream(tmp)
        this.rs.pipe(this.ws)
        this.ws.on('finish', () => {
       
          let dstDirUUID = this.file.parent.dstUUID 
          let policy = this.file.getPolicy()
          this.file.ctx.mkfile(dstDirUUID, this.file.srcName, tmp, null, policy, (err, xstat, resolved) => {
          
            if (err && err.code === 'EEXIST') {
              this.setState('Conflict', err, policy)
            } else if (err) {
              this.setState('Failed', err)
            } else {
              rimraf(tmp, () => {})
              this.setState('Finished')
            }

          })
        })
      }
    })
  }
}

const xcode = stat => {
  if (stat.isFile()) {
    return 'EISFILE'
  } else if (stat.isDirectory()) {
    return 'EISDIRECTORY'
  } else if (stat.isBlockDevice()) {
    return 'EISBLOCKDEV'
  } else if (stat.isCharacterDevice()) {
    return 'EISCHARDEV'
  } else if (stat.isSymbolicLink()) {
    return 'EISSYMLINK'
  } else if (stat.isFIFO()) {
    return 'EISFIFO'
  } else if (stat.isSocket()) {
    return 'EISSOCKET'
  } else {
    return 'EISUNKNOWN'
  }
}

const openwx = (target, policy, callback) => {
  fs.open(target, 'wx', (err, fd) => {
    if (err && err.code === 'EEXIST') {
      fs.lstat(target, (error, stat) => {
        if (error) return callback(error)

        const same = stat.isFile()  
        const diff = !same

        if ((same && policy[0] === 'skip') || (diff && policy[1] === 'skip')) {
          callback(null, null, [same, diff])
        } else if (same && policy[0] === 'replace' || diff && policy[1] === 'replace') {
          rimraf(target, err => {
            if (err) return callback(err)
            openwx(target, policy, (err, fd) => {
              if (err) return callback(err)
              callback(null, fd, [same, diff])
            })
          })
        } else if (same && policy[0] === 'rename' || diff && policy[1] === 'rename') {
          let dirname = path.dirname(target)
          let basename = path.basenmae(target)
          fs.readdir(dirname, (error, files) => {
            if (error) return callback(error)
            let target2 = path.join(dirname, autoname(basename, files))
            openwx(target2, policy, (err, fd) => {
              if (err) return callback(err)
              callback(null, fd, [same, diff])
            })
          })
        } else {
          err.xcode = xcode(stat)  
          callback(err)
        }
      })
    } else if (err) {
      callback(err)
    } else {
      callback(null, fd, [false, false])
    }
  })
}


class ExportWorking extends Working {

  enter () {
    super.enter()

    let srcDirUUID = this.file.parent.srcUUID     
    let fileUUID = this.file.srcUUID
    let fileName = this.file.srcName
    let dstDirPath = this.file.parent.dstPath
    let dstFilePath = path.join(dstDirPath, fileName)
    let policy = this.file.getPolicy()
  
    this.file.ctx.clone(srcDirUUID, fileUUID, fileName, (err, tmp) => {
      if (err) {
        this.setState('Failed', err)
      } else {
        openwx(dstFilePath, policy, (err, fd) => {
          if (err) {
            rimraf(tmp, () => {})
            this.setState('Failed', err) 
          } else {
            this.rs = fs.createReadStream(tmp) 
            this.ws = fs.createWriteStream(null, { fd })
            this.rs.pipe(this.ws)

            this.ws.on('finish', () => {
              rimraf(tmp, () => {})
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
    this.file.ctx.unindexWorkingFile(this.file)
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




