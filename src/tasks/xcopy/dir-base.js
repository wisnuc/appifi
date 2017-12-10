const Node = require('./node')
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
    this.ctx.ctx.indexConflictDir(this.ctx)
    this.err = err
    this.policy = policy
  }

  exit () {
    this.ctx.ctx.unindexConflictDir(this.ctx)
  }

  view () {
    return {
      error: this.err,
      policy: this.policy
    }
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

class FruitReading extends Reading {

  enter () {
    super.enter()
    // readdir always read source dir
    this.ctx.ctx.readdir(this.ctx.src.uuid, (err, xstats) => {
      if (err) {
        this.setState('Failed', err)
      } else {
        this.setState('Read', xstats)
      }
    })
  }

}

class Read extends State {

  enter (xstats) {
    this.ctx.ctx.indexReadDir(this.ctx)

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
    let children = [...this.ctx.children]
    children.forEach(c => c.destroy())
  }

  exit () {
    this.ctx.ctx.unindexFailedDir(this.ctx)
  }

}

class Finished extends State {

  enter () {
    this.ctx.ctx.indexFinishedDir(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexFinishedDir(this.ctx)
  }

}

/**
A directory sub-task, base class

@memberof XCopy
*/
class Dir extends Node {

  constructor(ctx, parent, src, dst, entries) {
    super(ctx, parent)
    this.children = []
    this.src = src
    if (dst) {
      this.dst = dst
      new this.Read(this, entries)
    } else {
      new this.Pending(this)
    }
  }

  destroy () {
    [...this.children].forEach(c => c.destroy())
    super.destroy()
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.dir[0] || null,
      this.policy[1] || this.ctx.policies.dir[1] || null
    ]  
  }

}

Dir.prototype.Pending = Pending
Dir.prototype.Working = Working
Dir.prototype.Reading = Reading
Dir.prototype.FruitReading = FruitReading
Dir.prototype.Read = Read
Dir.prototype.Conflict = Conflict
Dir.prototype.Finished = Finished
Dir.prototype.Failed = Failed

module.exports = Dir
