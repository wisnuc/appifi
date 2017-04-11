import EventEmitter from 'events'
const E = require('./error')

class Worker extends EventEmitter {

  constructor() {
    super()
    this.finished = false
  }

  cleanUp() {
  }

  finalize() {
    this.finished = true
    this.cleanUp() 
  }

  error(e, ...args) {
    this.emit('error', e, ...args)
    this.finalize()
  }

  finish(data, ...args) {
    this.emit('finish', data, ...args)
    this.finalize()
  }

  start() {
    if (this.finished) throw 'worker already finished'
    this.run()
  }

  abort() {
    if (this.finished) throw 'worker already finished'
    this.emit('error', new E.EABORT())
    this.finalize()
  }
}

export default Worker

