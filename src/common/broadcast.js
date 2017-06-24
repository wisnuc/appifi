const Debug = require('debug')

/**
Broadcast is a global event emitter implementing a pub-sub pattern.

It is designed for decoupling inter-module dependencies during system or module start up and shuting down, as the replacement of direct init/deinit function calls among modules. The latter is cumbersome for change and testing. Pub-Sub pattern works like a charm for this purpose.

For both emits and ons, a callback-like function signature are used. Example:

```
// emit
broadcast.emit('UserInitDone', err, data)

// on
broadcast.on('UserInitDone', (err, data) => {})
```

`debug` module is integrated in `emit` function. Thanks to its design, event name can be filtered easily and dynamically without much code.

To print out all events, use `DEBUG="event:*"`.

@module Broadcast
*/
module.exports = new class extends require('events') {

  /**
  Subscribe to a global event

  @param {string} name - event name
  @param {function} callback - with a node callback signature: `(err, data) => {}`
  */
  on(name, callback) {
    super.on(name, callback)
  }

  /**
  Publish a global event 

  @param {string} name - event name  
  @param {error} - if event fires an error
  @param {*} - if event fires an data
  */
  emit(name, err, data) {
    Debug(`event: ${name}`)(err, data)
    super.emit(name, err, data)
  }

  /**
  Returns a promise finished when all given events fired once without error.

  Internally it uses `Promise.all`. So if any event fired with an error, the promise is rejected.

  The function is convenient to `await` one or more events inside an `async` function.

  @param {string} names - a list of event names (spreaded).
  */
  until(...names) {
    return Promise.all(names.map(name => 
      new Promise((resolve, reject) => 
        this.once(name, (err, data) => 
          err ? reject(err) : resolve(data)))))
  }
}


