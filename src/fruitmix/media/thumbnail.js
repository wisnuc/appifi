const EventEmitter = require('events')
const UUID = require('node-uuid')

class State extends EventEmitter {

  constructor() {
    super()
    this.finished = false,
      this.id = UUID.v4()
  }

  // setState(nextState, ...args) {
  //   this.exit()
  //   this.ctx.state = new nextState(this.ctx, ...args)
  // }

  start() {
    if (this.finished) throw new Error('worker is already finished')
    this.run()
  }

  run() {
    this.finished = true
  }

  abort() {
    if (this.finished) throw new Error('worker is already finished')
    this.emit('error', new Error('worker is already aborted'))
    this.exit()
  }

  finish(...args) {
    this.emit('finish', ...args)
    this.exit()
  }

  error(...args) {
    this.emit('error', ...args)
    this.exit()
  }

  exit() {
    this.finished = true
  }
}

// class Pending extends State {

//   constructor(data) {
//     super()
//     this.isRunning = false
//     this.state = 'PENDING'
//     this.data = data
//   }

//   abort() {}

//   exit() {}
// }

class Worker extends EventEmitter {

  constructor() {
    super()
    this.isRunning = false
    this.finished = false
    this.state = 'PENDING'
    // this.data = data

  }

  start() {
    if (this.finished) throw new Error('worker is already finished')
    this.run()
  }

  run() {
    this.finished = true
    this.state = 'WORKING'
    //TODO: 
    // request(this.data)
    this.finish()
  }

  abort() {
    if (this.finished) throw new Error('worker is already finished')
    this.emit('error', new Error('worker is already aborted'))
    this.exit()
  }

  finish(...args) {
    this.emit('finish', ...args)
    this.exit()
  }

  error(...args) {
    this.emit('error', ...args)
    this.exit()
  }

  exit() {
    this.finished = true
  }
}

class Thumbnail {

  constructor(limit) {
    this.workingQ = []
    this.limit = limit || 40
  }

  // 调度器
  schedule() {
    function isBigEnough(value) {
      return value >= 10;
    }

    var filtered = [12, 5, 8, 130, 44].filter(isBigEnough);
    // filtered is [12, 130, 44]
    console.log(filtered);
    console.log(222, typeof this.workingQ[0])
    let workingQLength =
      this.WorkingQ.filter(working => {
        console.log(2)
        working.isRunning
      }).length

    let diff = this.limit - workingQLength
    if (diff) return

    this.WorkingQ.filter(worker => !worker.isRunning())
      .slice(0, diff)
      .forEach(worker => worker.start())
  }

  /**
    digest: 'string'
    userUUID： 'string'
    query: 'object' 
   */
  request(query) {
    let working = this.createWorker(query)
    console.log(11, JSON.stringify(working))
    working.on('finish', worker => {
      worker.state = 'FINISHED'
      this.schedule()
    })
    // error
    working.on('error', worker => {
      worker.state = 'WARNING'
      this.WorkingQ.splice(this.WorkingQ.indexOf(worker), 1)
      this.WorkingQ.push(worker)
      this.schedule()
    })
    this.workingQ.push(working)
    this.schedule()


  }

  createWorker(data) {
    let working = new Worker(data)
    return working
  }

  abort() {
    //FIXME: abort this.workingQ
  }

  register(ipc) {
    ipc.register('run', this.run.bind(this))
  }
}


let tl = new Thumbnail(40)
console.log('tl:', tl)

tl.request({
  age: 2
})


module.exports = Thumbnail