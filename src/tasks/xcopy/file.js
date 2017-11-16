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

class Working extends State {
  
  enter () {
    this.file.ctx.indexWorkingFile(this.file)

    let srcDirUUID = this.file.parent.srcUUID
    let dstDirUUID = this.file.parent.dstUUID
    let fileUUID = this.file.srcUUID
    let fileName = this.file.srcName

    this.file.ctx.cpFile(srcDirUUID, fileUUID, fileName, dstDirUUID, null, (err, xstat, resolved) => {
      if (err) {
        // TODO may be conflict
        this.setState(Failed, err)
      } else {
        this.setState(Finished)
      }
    }) 
  }

  exit () {
    this.file.ctx.unindexWorkingFile(this.file)
  }
}

class Conflict extends State {

  enter () {
    this.file.ctx.indexConflictFile(this.file)
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

  constructor(ctx, parent, srcUUID, srcName) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName

    this.state = new Pending(this)
  }

  setState (NextState) {
    this.state.setState(NextState)
  }

  nodepath () {
    let arr = []
    for (let n = this; n !== null; n = n.parent) {
    }
  } 

  destroy (detach) {
    this.state.destroy()
    super.destroy(detach)
  }
}

File.Pending = Pending
File.Working = Working
File.Conflict = Conflict
File.Finished = Finished
File.Failed = Failed

module.exports = File




