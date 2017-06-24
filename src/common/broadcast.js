const Debug = require('debug')

/**
The global event bus.

@module Broadcast
*/
module.exports = new class extends require('events') {

  emit(name, err, data) {
    Debug(`event:${name}`)(err, data)
    super.emit(name, err, data)
  }

  until(...names) {
    return Promise.all(names.map(name => 
      new Promise((resolve, reject) => 
        this.once(name, (err, data) => 
          err ? reject(err) : resolve(data)))))
  }
}


