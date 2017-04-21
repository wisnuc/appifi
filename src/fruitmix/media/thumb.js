
const EventEmitter = require('events')
const UUID = require('node-uuid')

import E from '../lib/error'

function say(name, callback) {
  setInterval(() => {
    callback(null, 'I`m dodo ' + name)
  },100)
}
class Worker extends EventEmitter {

  constructor(src, digest, userUUID, query) {
    super()
    this.finished = false
    this.state = 'pending'
    this.id = UUID.v4()

    this.src = src
    this.digest = digest
    this.userUUID = userUUID
    this.query = query

    this.callback = null
  }

  start() {
    if (this.finished) throw new Error('worker is already finished')
    this.run()
  }

  run() {
    if (this.state != 'pending') return
    this.state = 'running'
    //TODO: 执行体
    // this.data
    
    say(this.data, (err, data) => {
      if(err) return this.error(err)
      this.finish(this)
    })
    
  }

  abort() {
    if (this.finished) throw new Error('worker is already finished')
    this.emit('error', new E.EABORT())
    this.exit()
  }

  finish(data, ...args) {
    //释放资源
    this.emit('finish', data, ...args)
    this.exit()
  }

  error(err) {
    this.emit('error', err)
    this.exit()
  }
 
  exit() {
    this.finished = true
  }
}

class Thumbnail {

  constructor(limit) {
    this.workerQueue = new Map()
    this.limit = limit || 40
  }

  // 调度器
  schedule() {
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
    src: src
    digest: 'string'
    userUUID： 'string'
    query: 'object' 
   */
  request({src, digest, userUUID, query}, callback) {
    
    if (this.pendingQ.length > 1000) {
      throw new Error('请求过于频繁')
    } 
 
    let worker = this.createrWorker(src, digest, userUUID, query, callback) 
    worker.nonblock == true ?
      this.pendingQ.unshift(worker) : this.pendingQ.push(worker)
    worker.on('finish', worker => {
      worker.state = 'finished'
      process.nextTick(() => worker.callback())
      this.schedule()
    })
    worker.on('error', worker => {
      worker.state = 'warning'
      this.workersQueue.splice(this.workersQueue.indexOf(worker), 1)
      this.warningQueue.push(worker)
      this.schedule()
    })
  }

  
  // factory function
  createrWorker(src, digest, userUUID, query, callback) {
    let worker = new Worker(src, digest, userUUID, query, callback)
    worker.callback = callback
    return worker
  }


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