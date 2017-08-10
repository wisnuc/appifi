const EventEmitter = require('events')
const debug = require('debug')('transform')

class Transform extends EventEmitter {

  constructor (options) {
    super()
    this.concurrency = 1

    Object.assign(this, options)

    this.pending = []
    this.working = []
    this.finished = []
    this.failed = []

    this.ins = []
    this.outs = []
  }

  push (x) {
    this.pending.push(x)
    this.schedule()
  }

  pull () {
    let xs = this.finished
    this.finished = []
    this.schedule()
    return xs
  }

  isBlocked () {
    return !!this.failed.length ||              // blocked by failed
      !!this.finished.length ||                 // blocked by output buffer (lazy)
      this.outs.some(t => t.isBlocked())        // blocked by outputs transform
  }

  isStopped () {
    return !this.working.length && this.outs.every(t => t.isStopped())
  }

  root () {
    return this.ins.length === 0 ? this : this.ins[0].root()
  }

  pipe (next) {
    this.outs.push(next)
    next.ins.push(this)
    return next
  }

  print () {
    debug(this.name,
      this.pending.map(x => x.name),
      this.working.map(x => x.name),
      this.finished.map(x => x.name),
      this.failed.map(x => x.name),
      this.isStopped())
    this.outs.forEach(t => t.print())
  }

  schedule () {
    // stop working if blocked
    if (this.isBlocked()) return

    this.pending = this.ins.reduce((acc, t) => [...acc, ...t.pull()], this.pending)

    while (this.working.length < this.concurrency && this.pending.length) {
      let x = this.pending.shift()
      this.working.push(x)
      this.transform(x, (err, y) => {
        this.working.splice(this.working.indexOf(x), 1)
        if (err) {
          x.error = err
          this.failed.push(x)
        } else {
          if (this.outs.length) {
            this.outs.forEach(t => t.push(y))
          } else {
            if (this.root().listenerCount('data')) {
              this.root().emit('data', y)
            } else {
              this.finished.push(y)
            }
          }
        }

        this.schedule()
        this.root().emit('step', this.name, x.name)
      })
    }
  }

}

module.exports = Transform
