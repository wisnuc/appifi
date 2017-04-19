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
    this.finished = false
    this.state = 'PENDING'
    // this.data = data

  }

  start() {
    if (this.finished) throw new Error('worker is already finished')
    this.run()
  }

  run(query) {
    if (this.state != 'PENDING') return 
    this.state = 'RUNNING'
    setInterval( () => {
      this.isRunning = true
      // this.state = 'WORKING'
      console.log('wujj')
      //TODO: 
      // request(this.data)
      this.finish(this)
    }, 1000)
   
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
  
  isRunning() {
    return this.state === 'RUNNING'
  }
  exit() {
    this.finished = true
  }
}

class Thumbnail {

  constructor(limit) {
    this.pendingQ = []
    this.runningQ = []
    this.limit = limit || 40
  }

  // 调度器
  schedule() {
    console.log('schedule: ', JSON.stringify(this.runningQ))
    let runningQLength =
      this.runningQ.filter(working => working.isRunning).length

    let diff = this.limit - runningQLength
    if (diff <= 0) return

    this.runningQ.filter(worker => !worker.isRunning)
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
    //1. 往pendingQ塞
    working.on('finish', worker => {
      // console.log(123123,worker)
      // worker.state = 'FINISHED'
      this.schedule()
    })
    // // error
    // working.on('error', worker => {
    //   worker.state = 'WARNING'
    //   this.runningQ.splice(this.runningQ.indexOf(worker), 1)
    //   this.runningQ.push(worker)
    //   this.schedule()
    // })
    this.runningQ.push(working)
    this.schedule()


  }

  createWorker(data) {
    let working = new Worker(data)
    return working
  }

  abort() {
    //FIXME: abort this.runningQ
  }

  register(ipc) {
    ipc.register('run', this.run.bind(this))
  }
}


let tl = new Thumbnail(4)
console.log('tl:', tl)


setInterval(function(){
  tl.request({
    age: 2
  })
},1000)
// tl.request({
//   age: 2
// })

module.exports = Thumbnail