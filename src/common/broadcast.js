const Debug = require('debug')

module.exports = new class extends require('events') {

  emit(name, ...args) {
    Debug(`event:${name}`)(...args)
    super.emit(name, ...args)
  }

  until(...names) {
    return Promise.all(names.map(name => 
      new Promise(resolve => this.once(name, resolve))))
  }
}


