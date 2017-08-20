const EventEmitter = require('events')
const debug = require('debug')('monitor')

/**
Monitor is used to track `read` operation on `Directory` objects.
*/
class Monitor extends EventEmitter {

  constructor() {

    super()

    this.set = new Set()
    this.count = 0
    this.done = new Promise((resolve, reject) => this.on('done', data => resolve(data)))
  }

  start(dirUUID, name) {
    this.set.add(dirUUID)
    this.count++ 
    debug(`monitor + ${dirUUID}, current: ${this.set.size}, total: ${this.count}, ${name}`)
  }
  
  end(dirUUID, name) {
    this.set.delete(dirUUID)
    debug(`monitor - ${dirUUID}, current: ${this.set.size}, total: ${this.count}, ${name}`)
    if (this.set.size === 0) this.emit('done')
  }
}

module.exports = Monitor


