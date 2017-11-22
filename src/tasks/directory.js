class State {

  constructor(dir, ...args) {
    this.dir = dir
    this.enter(...args)
  }

  destroy () {
    this.exit()
  }

  setState (NextState), ...args) {
    this.exit()
    new NextState(this.dir, ...args)
  }

  enter () {
  }

  exit () {
  }
}

class Pending {

  enter () {
    this.dir.ctx.indexPendingDir(this.dir)
  }

  exit () {
    this.dir.ctx.unindexPendingDir(this.dir)
  } 
}

class Making {
  
  enter () {
    this.dir.ctx.indexMkdir(this.dir)
  }

  exit () {
    this.dir.ctx.unindexMkdir(this.dir)
  }
}

class Conflict {

  enter () {
    this.dir.ctx.indexConflictDir(this.dir)
  }

  exit () {
    this.dir.ctx.unindexConflictDir(this.dir)
  }
}

class Reading {

  enter () {
    this.dir.ctx.indexReadingDir(this.dir)

    this.dir.ctx.readdir
  }  

  exit () {
    this.dir.ctx.unindexReadingDir(this.dir)
  }
}

class Read {

  enter (xstats) {
    this.dir.ctx.indexReadDir(this.dir)
    this.dir.children = []
    xstats.forEach(x => {
      if (x.type === 'directory') {
        new Directory(this.dir.ctx, this.dir, x.uuid)
      }

      if (x.type === 'file') {
        new File(this.dir.ctx, this.dir, x.uuid, x.name)
      }
    })
  }

  exit () {
    this.dir.ctx.unindexReadDir(this.dir)
  }
}

class Failed {
  // when directory enter failed 
  // all descendant node are destroyed (but not removed)
  enter () {
    this.dir.ctx.indexFailedDir(this.dir)
    this.dir.children.forEach(c => c.destroy())
  }

  exit () {
    this.dir.ctx.unindexFailedDir(this.dir)
  }
}

class Directory {

  constructor(ctx, parent, srcUUID, dstUUID, children = []) {
    this.ctx = ctx
    this.parent = parent
    this.srcUUID = srcUUID
    if (dstUUID) {
      this.dstUUID = dstUUID
      this.children = children 
      
    } else {
      new Pending(this)
    }
  } 

  destroy () {
    this.children.forEach(c => c.destroy())
    this.state.destroy ()
  }
}

module.exports = Directory

