const Node = require('./node')

class State {

  constructor(file, ...args) {
    this.file = file
    this.enter(...args)
  }

  destroy () {
    this.exit()
  }

  setState (NextState, ...args) {
    this.exit()
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
        this.setState(Conflict, err, policy)
      } else if (err) {
        this.setState(Failed, err)
      } else {
        this.setState(Finished)
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
        this.setState(Conflict, err, policy)
      } else if (err) {
        this.setStaate(Failed, err)
      } else {
        this.setState(Finished)
      }
    })
  }

}

class ImportWorking extends Working {

  enter () {
    super.enter()

    
  }
}

class ExportWorking extends Working {

  enter () {
    super.enter()

  }
}

class Conflict extends State {

  enter () {
    this.file.ctx.indexConflictFile(this.file)
  }

  retry () {
    this.setState(Working)
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

  setState (NextState) {
    this.state.setState(NextState)
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
  }

}

MoveFile.prototype.Working = MoveWorking

class ImportFile extends File {

  constructor(ctx, parent, srcPath) {
    super(ctx, parent)
    this.srcPath = srcPath
  }

}

ImportFile.prototype.Working = ImportWorking

class ExportFile extends File {

  constructor(ctx, parent, srcUUID, srcName) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
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




