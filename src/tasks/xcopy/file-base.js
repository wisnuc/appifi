const Node = require('./node')
const State = require('./state')

class Pending extends State {

// this.ctx => file
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
    if (this.ctx.ctx) this.ctx.ctx.unindexWorkingFile(this.ctx)
  }

}

class Conflict extends State {

  enter (err, policy) {
    this.ctx.ctx.indexConflictFile(this.ctx)
    this.err = err
    this.policy = policy
  }

  exit () {
    this.ctx.ctx.unindexConflictFile(this.ctx)
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

  constructor (ctx, parent, src) {
    super(ctx, parent)
    this.src = src
    this.state = new this.Pending(this)
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

File.prototype.Pending = Pending
File.prototype.Working = Working // <- this will be overridden
File.prototype.Conflict = Conflict
File.prototype.Finished = Finished
File.prototype.Failed = Failed

module.exports = File
