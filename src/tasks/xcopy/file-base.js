const State = require('./state')

class Pending extends State {

  enter () {
    this.ctx.ctx.indexPendingFile(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexPendingFile(this.ctx)
  }

}

// Working state is overridden by each File derivatives
class Working extends State {

  enter () {
    this.ctx.ctx.indexWorkingFile(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexWorkingFile(this.ctx)
  }

}

class Conflict extends State {

  enter () {
    this.ctx.ctx.indexConflictFile(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexConflictFile(this.ctx)
  }

}

class Failed extends State {

  enter (e) {
    this.ctx.ctx.indexFailedFile(this.ctx)
    this.ctx.emit('error', e)
  }

  exit () {
    this.ctx.ctx.unindexWorkingFile(this.ctx)
  }

}

class Finished extends State {

  enter () {
    this.ctx.ctx.indexFinishedFile(this.ctx)
    this.ctx.emit('finish')
  }

  exit () {
    this.ctx.ctx.unindexFinishedFile(this.ctx)
  }

}

/**
A file sub-tasks, base class

@memberof XCopy
*/
class File extends Node {

  view () {
    let obj = {
      type: 'directory',
      parent: this.parent && this.parent.srcUUID,
      srcUUID: this.srcUUID
    }

    if (this.dstUUID) obj.dstUUID = this.dstUUID
    obj.state = this.getState()
    if (this.policy) obj.policy = this.policy
    return obj
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.file[0] || null,
      this.policy[1] || this.ctx.policies.file[1] || null
    ]  
  }
  
}

File.prototype.Pending = Pending
File.prototype.Working = Working      // <- this will be overridden
File.prototype.Conflict = Conflict
File.prototype.Finished = Finished
File.prototype.Failed = Failed

module.exports = File
