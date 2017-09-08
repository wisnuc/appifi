const EventEmitter = require('events')


class Identify extends EventEmitter {

  constructor () {
    super()
    this.pending = []
    this.xstat1 = []
    this.identify = []
    this.xstat2 = []
  }

  push(x) {
    this.pending.push(x)
    this.schedule()
  }

  schedule() {
    if (this.destroyed) return

    while (this.working.length < this.concurrency && this.pending.length) {
      // from pending to working

      let x = this.pending.shift()
      this.working.push(x)

      x.
    }
  }
}
