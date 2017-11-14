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

class Pending {

  enter () {
    this.file.ctx.indexPendingFile(this.file)
  }

  exit () {
    this.file.ctx.unindexPendingFile(this.file)
  }
}

class Working {
  
  enter (srcPath, dstPath) {
    this.file.ctx.indexWorkingFile(this.file)
  }

  exit () {
    this.file.ctx.unindexWorkingFile(this.file)
  }
}

class Conflict {

  enter () {
    this.file.ctx.indexConflictFile(this.file)
  }

  exit () {
    this.file.ctx.unindexConflictFile(this.file)
  }
}

class Failed {

  enter () {
    this.file.ctx.indexFailedFile(this.file)
  }

  exit () {
    this.file.ctx.unindexWorkingFile(this.file)
  }
}

class File {

  constructor(ctx, parent, uuid, name) {
    this.ctx = ctx
    this.parent = parent
    this.uuid = uuid
    this.name = name

    this.state = new Pending(this)
  }

  setState(

  nodepath () {
    let arr = []
    for (let n = this; n !== null; n = n.parent) {
    }
  } 
}

module.exports = File




