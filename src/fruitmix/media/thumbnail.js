
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

class Worker extends State {

  constructor(ctx, data) {
    super(ctx)
    this.isRunning = false
    this.state = 'PENDING'
    this.data = data

  }
  
  run() {
    this.state = 'WORKING'
    //TODO: request(this.data)
    this.finish()
  }

}

class Thumbnail {

  constructor(limit) {
    this.workingQ = []
    this.limit = limit || 40
  }

  // 调度器
  schedule() {
    let workingQLength = 
      this.WorkingQ.filter(working => working.isRunning()).length

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
  async request(query) {
    let working = this.createWorker(this.data, query)
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

  async createWorker(data) {
    let working = new Worker(data)
    return working
  }

  abort() {
    //FIXME: abort this.workingQ
  }
}

module.exports = Thumbnail