import EventEmitter from 'events'

class Worker extends EventEmitter {

  constructor() {
    super()
    this.finished = false
  }

  cleanUp() {
  }

  finalize() {
    this.cleanUp() 
    this.finished = true
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

