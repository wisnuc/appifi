const EventEmitter = require('events')

class Worker extends EventEmitter{

  constructor(data) {
    this.finished = false
    this.state = 'pending'
    this.callback = null
    this.data = data
  }

  start(callback) {
    this.callback = callback 
    if (this.finished) throw new Error('worker is already finished')
    this.run()
  }

  run() {
    if (this.state != 'pending') return
    this.state = 'running'
    //TODO: 执行体
    // this.data
    
    console.log('wujj')
    // request(this.data)
    this.finish(this)
  }

  abort() {
    if (this.finished) throw new Error('worker is already finished')
    this.exit()
  }

  finish() {
    if(this.callback) this.callback(null, 'finish')
    this.exit()
  }

  error(err) {
    if(this.callback) this.callback(err)
    this.exit()
  }
 
  exit() {
    this.finished = true
  }
}

class Thumbnail {

  constructor(limit) {
    this.pendingQ = []
    this.workingQ = []
    this.flag = true
    this.limit = limit || 40
  }

  // 调度器
  schedule() {
    console.log('schedule: ', JSON.stringify(this.workingQ))

    // filter already finished worker
    this.workingQ = this.workingQ.filter(worker => !worker.finished)

    let workingQLength = this.workingQ.length
    let diff = this.limit - workingQLength
    if (diff <= 0) return

    let newArr = this.pendingQ.splice(0, diff)
    this.workingQ = this.workingQ.concat(newArr)

    this.workingQ.slice(workingQLength)
      .forEach(worker => worker.start((err, data) => {
        //FIXME: 处理错误
        // if(err) {
        //   worker.start()
        //   return 
        // }
        this.schedule()
      }))

  }

  /**
    digest: 'string'
    userUUID： 'string'
    query: 'object' 
   */
  request(query) {
    
    if (this.pendingQ.length > 1000) {
      throw new Error('请求过于频繁')
    } 
    let worker = new Worker(query)
    worker.nonblock == true ?
      this.pendingQ.unshift(worker) : this.pendingQ.push(worker)
    
    this.schedule()
  }

  // TODO: 定时器，定时调用schedule


  //TODO: abort this.workingQ
  abort() {

  }

  register(ipc) {
    ipc.register('run', this.request.bind(this))
  }
}


let tl = new Thumbnail(40)
console.log('tl:', tl)


setInterval(function () {
  tl.request({
    age: 2
  })
}, 1)
// tl.request({
//   age: 2
// })

module.exports = Thumbnail