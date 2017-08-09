class Transform extends EventEmitter {

  constructor (options) {
    super()
    this.concurrency = 1 

    Object.assign(this, options)

    this.pending = []
    this.working = []
    this.finished = []
    this.failed = []

    this.prev = []
    this.next = null
  } 

  push (x) {
    this.pending.push(x)
    this.schedule()
  }

  pull() {
    let xs = this.finished
    this.finished = [] 
    this.schedule()
    return xs
  }

  isBlocked () {
    return !!this.failed.length                       // blocked on fail
      || !!this.finished.length                       // blocked on output buffer (lazy)
      || (this.next ? this.next.isBlocked() : false)  // blocked on next (chained blocking)
  }

  isRunning () {
    return !this.isStopped()
  }

  isStopped () {
    return !this.working.length                       // no working
      && (this.next ? this.next.isStopped() : true)   // traverse
  }

  isSelfStopped () {
    return !this.working.length                       // for debug
  }

  root () {
    return this.prev.length === 0
      ? this
      : this.prev[0].root()
  }

  tail () {
    return this.next === null
      ? this
      : this.next.tail()
  }

  pipe (next) {
    let tail = this.tail()
    tail.next = next
    next.prev = tail
    return this
  }

  print() {
    console.log(this.name, 
      this.pending, 
      this.working, 
      this.finished, 
      this.failed, 
      this.prev && this.prev.name,
      this.next && this.next.name,
      this.isStopped(),
      this.isSelfStopped()
    )
    if (this.next) this.next.print()
  }

  schedule () {
    // stop working if blocked
    if (this.isBlocked()) return 

    // pull prev
    if (this.prev) {
      this.pending = [...this.pending, ...this.prev.pull()]
    }

    while (this.working.length < this.concurrency && this.pending.length) {
      let x = this.pending.shift() 
      this.working.push(x)
      this.transform(x, (err, y) => {
        this.working.splice(this.working.indexOf(x), 1)
        if (err) {
          x.error = err
          this.failed.push(x)
        } else {
          if (this.next) {
            this.next.push(y)
          } else {
            if (this.root().listenerCount('data')) {
              this.head().emit('data', y)
            } else {
              this.finished.push(y)
            }
          }
        }

        this.schedule()
        this.head().emit('step', this.name, x.name)
      })
    }
  }
}

