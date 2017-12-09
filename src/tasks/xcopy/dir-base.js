const State = require('./state')

class Pending extends State {

  enter () {
    this.ctx.ctx.indexPendingDir(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexPendingDir(this.ctx)
  } 

}

class Working extends State {

  enter () {
    this.ctx.ctx.indexWorkingDir(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexWorkingDir(this.ctx)
  } 

}

class Conflict extends State {

  enter (err, policy) {
    this.err = err
    this.policy = policy
    this.ctx.ctx.indexConflictDir(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexConflictDir(this.ctx)
  }

}

class Reading extends State {

  enter () {
    this.ctx.ctx.indexReadingDir(this.ctx)
  } 

  exit () {
    this.ctx.ctx.unindexReadingDir(this.ctx)
  }

}

class Read extends State {

  enter (xstats) {
    this.ctx.ctx.indexReadDir(this.ctx)
    this.entries = 

    this.ctx.dstats = xstats.filter(x => x.type === 'directory')
    this.ctx.fstats = xstats.filter(x => x.type === 'file')
    this.next()
  }

  exit () {
    this.ctx.ctx.unindexReadDir(this.ctx)
  }

}

class Failed extends State {
  // when directory enter failed 
  // all descendant node are destroyed (but not removed)
  enter (err) {
    this.ctx.ctx.indexFailedDir(this.ctx)
    this.ctx.children.forEach(c => c.destroy())
    this.ctx.emit('error', err)
  }

  exit () {
    this.ctx.ctx.unindexFailedDir(this.ctx)
  }

  getState () {
    return 'Failed'
  }
}

class Finished extends State {

  enter () {
    this.ctx.ctx.indexFinishedDir(this.ctx)
    this.ctx.emit('finish')
  }

  exit () {
    this.ctx.ctx.unindexFinishedDir(this.ctx)
  }

  getState () {
    return 'Finished'
  }
}

/**
A directory sub-task, base class

@memberof XCopy
*/
class Directory extends Node {

  constructor(ctx, parent) {
    super(ctx, parent)
    this.children = []
  }

  destroy () {
    [...this.children].forEach(c => c.destroy())
    super.destroy()
  }

  identity () {
    return this.srcUUID
  }

  view () {
    let obj = {
      type: 'directory',
      parent: this.parent && this.parent.srcUUID,
      srcUUID: this.srcUUID
    }
    
    if (this.dstUUID) obj.dstUUID = this.dstUUID
    obj.state = this.state.getState()
    if (this.policies) obj.policy = this.policy
    return obj
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.dir[0] || null,
      this.policy[1] || this.ctx.policies.dir[1] || null
    ]  
  }

}

Directory.prototype.Pending = Pending
Directory.prototype.Working = Working
Directory.prototype.Reading = FruitReading
Directory.prototype.Read = Read
Directory.prototype.Conflict = Conflict
Directory.prototype.Finished = Finished
Directory.prototype.Failed = Failed


