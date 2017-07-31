const EventEmitter = require('events')
const E = require('../lib/error')

/**
Class Worker is the abstract, base class to be extended by concrete worker classes.

Concrete worker classes use `error` and `finish` function to emit events.

They should guarantee `error` or `finish` is called exactly once.

They must implement/override `run` virtual method. 

They can override `cleanup` virtual method for proper destruction.

`start` and `abort` are public (interface) functions. 

When aborting, an `EABORT` error is emitted.

> Internally, `this.finished` indicates whether the worker have been finished or not, either due to error or user abort. Concrete worker should check this state after EVERY STEP an asynchronous operation returns to detect finished state early as possible and stop any further actions immediately.
*/
class Worker extends EventEmitter {

  /**
    Base class constructor 
  */ 
  constructor() {
    super()
    this.finished = false
  }

  /**
    Run the worker. Implemented by subclasses.
    @virtual
  */
  run() {
  }

  /**
    Clean up when worker finishes. Subclasses override this function if there are resources to be
    recycled when finishing.

    This function is called by `finalize`, when emitting `error` or `finish` event, as well as aborting.
    @virtual 
  */
  cleanUp() {
  }

  /**
    Finalize when finished. 

    This is a private function for base class. Subclasses should not call this function generally.
    @private
  */
  finalize() {
    this.finished = true
    this.cleanUp() 
  }

  /**
    Subclasses call this function to emit `error` event
    @param {error} e - error object to be passed to event handler, should be an instance of Error
    @param {*} args - other arguments to be passed to event handler
  */
  error(e, ...args) {
    this.finalize()
    this.emit('error', e, ...args)
  }

  /**
    Subclasses call this function to emit `finish` event
    @param {*} data - data to be passed to event hander
    @param {*} args - other arguments to be passed to event handler
  */
  finish(data, ...args) {

    this.finalize()
    this.emit('finish', data, ...args)
  }

  /**
    Start the worker. Public function.
  */
  start() {
    if (this.finished) throw 'worker already finished'
    this.run()
  }

  /**
    Abort the worker. Public function.
  */
  abort() {
    if (this.finished) throw 'worker already finished'
    this.emit('error', new E.EABORT())
    this.finalize()
  }
}

module.exports = Worker

