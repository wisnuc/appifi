const EventEmitter = require('events')
const UUID = require('node-uuid')

class State extends EventEmitter {

  constructor(ctx) {
    super()
    this.ctx = ctx
    this.finished = false
  }

  setState(nextState, ...args) {
    this.exit()
    this.ctx.state = new nextState(this.ctx, ...args)
  }

  run() {}

  finish(...args) {
    this.emit('finish', ...args)
    this.exit()
  }

  abort(...args) {
    this.emit('error', ...args)
  }

  exit() {
    this.finished = true
  }
}

class Pending extends State {

  constructor(ctx) {
    super(ctx)
    this.run(data)
  }

  run(data) {
    //
    this.
    this.setState(Working, data)
  }

  exit() {
    clearTimeout(this.timer)
  }
}

class Working extends State {

  constructor(ctx, data) {
    super(ctx)
    this.data = data
  }
  
  run(data) {
    // console.log('Working save', data)
    this.next = data
  }

  error(e) {
    console.log('error writing persistent file', e)
    if (this.next)
      this.setState(Pending, this.next)
    else
      this.setState(Pending, this.data)
  }

  finish() {
    if (this.next)
      this.setState(Pending, this.next)
    else
      this.setState(Idle)
  }

  
}

class Thumbnail {

  constructor(limit) {

    this.workingQ = []
    this.limit = limit || 40
    this.state = new Pending(this)
  }

  schedule() {
    let workingQLength =
      this.WorkingQ.filter(working => working.isRunning()).length

    let diff = this.limit - workingQLength
    if (diff) return

    this.workersQueue.filter(worker => !worker.isRunning())
      .slice(0, diff)
      .forEach(worker => worker.start())
  }

  run(data) {
    // this.state.run(data)
  }
}

const createPersistenceAsync = async(target, tmpdir, delay) => {

  let targetDir = path.dirname(target)
  await mkdirpAsync(targetDir)
  await mkdirpAsync(tmpdir)
  return new Persistence(target, tmpdir, delay)
}

module.exports = Thumbnail