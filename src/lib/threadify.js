const Promise = require('bluebird')
const stream = require('stream')
const debug = require('debug')('threadify')

/**
K combinator, used to do something before passing the value, in one-line
*/
const K = x => y => x

/**
This module exports a function to mix the threadify class into a given base class.

`threadify` unions callback, event handler, and async functions in concurrent programming.

##### `define` and `defineSetOnce`

These functions can define class members as observables.

##### `until` and `untilAnyway`

These functions accepts a function as `predicate` and returns a promise.

The predicate should evaluate a expression of observable members.

When a observable is set or updated, the predicate will be called. If they evaluates to truthy value, the promise is resolved.

The `error` member is also an observable. If set, the promise returned by `until` will be rejected, while the one returned by `untilAnyway' will not.

##### `run`

It is the convention for the implementation class to define an async function named `run`, and put most logic there.

The `run` function concerns only for run to success or run to error, but not run to finish. In most case, try/catch/finally blocks should be avoided in `run`.

If the implementation class is going to emit events, such as data, error, or finish, they should be implemented in the following way:

```javascript
  constructor() {

    ....

    this.run()
      .then(data => { 
        this.data = data
        this.emit('data', this.data)
      })
      .catch(e => {
        this.error = e
        // error is not emitted here, it should be emitted in error setter.
      })

    this.untilAnyway(() => expression_for_finish_condition)
      .then(() => this.emit('finish'))
  }
```

Separating run to success/error and run to finish logic in two difference processes helps to keep the `run` clean and easy. 

It is very hard and error-prone to program both error/success and finally logic in single async function.

##### Sub-Process

Separating run to success/error and run-to-finish logic makes it harder to program nested logic in single async function.

It is recommended to extract the logic into a separate function. An example can be found in `NewNonEmptyFileHandler` and `AppendHandler` in writedir.


##### Examples

There are several examples in this project:

1. In `fruitmix/forest/writedir.js`, both `PartHandler` and `Writedir` are implemented using threadify. A parent-children composition pattern is easily achieved.
2. `lib/fs-append-stream,js` implements a stream.Writable, where the finally logic is triggered from the external components.
3. `lib/fingerprint.js` implements a concurrent child process. For simplicity, it does not implement child process as threadified. Instead, it use a closure array to guarantee all child process to exit.

@module Threadify
*/

const EABORT = Object.assign(new Error('aborted'), { code: 'EABORT' })

/**
@param {class} base - base class to be mixed in.
@return {class} New class with threadify members and methods mixed-in.
*/
module.exports = base => class extends base {

  /**
  Threadify is a mixin class for the derivatives to:
  1. define observable properties
  2. wait for a condition to be met before continuing, in both callback and async context.

  @class threadify
  */
  constructor (...args) {
    super(...args)
    this.EABORT = EABORT
    this._thrListeners = []
  }

  /**
  Define an observable property with given name, value, and optional options.
 
  @memberof module:Threadify~threadify
  @function define
  @instance 
  @param {string} name - property name
  @param {*} value - default value
  @param {function} [action] - triggered after value update and before calling listeners
  */
  define (name, value, action) {
    let _name = '_' + name
    this[_name] = value
    Object.defineProperty(this, name, {
      get: function () {
        return this[_name]
      },
      set: function (x) {
        debug('set', name,
          x instanceof stream
            ? 'stream'
            : Array.isArray(x)
              ? 'array length ' + x.length
              : x)
        this[_name] = x
        if (action) action()
        process.nextTick(() => this.updateListeners())
      }
    })
  }

  /**
  Define an observable property that can only be set once with a truthy value. The property is initialized to undefined.

  @memberof module:Threadify~threadify
  @function defineSetOnce
  @instance
  @param {string} name - property name
  @param {function} [action] - triggered after value update and before calling listeners
  */
  defineSetOnce (name, action) {
    let _name = '_' + name
    this[_name] = undefined
    Object.defineProperty(this, name, {
      get: function () {
        return this[_name]
      },
      set: function (x) {
        if (this[_name]) return
        debug('set once', name,
          x instanceof stream
            ? 'stream'
            : Array.isArray(x)
              ? 'array length ' + x.length
              : x)
        this[_name] = x
        if (action) action()
        process.nextTick(() => this.updateListeners())
      }
    })
  }

  /**
  This is an async function. 

  The given predicate is evaluated each time an observable is updated. The promise is resolved when the predicate evaluates to a truthy value, or is rejected when this.error is set.

  @memberof module:Threadify~threadify
  @function until
  @instance
  @param {function} predicate - a function evaluates to truthy or falsy value
  @returns {promise}
  */
  async until (predicate) {
    if (this.error) throw this.error
    if (predicate()) return
    return new Promise((resolve, reject) =>
      this._thrListeners.push({ predicate, resolve, reject }))
  }

  /**
  Similar to `until` but differs in that the promise won't be rejected by `this.error`.
  @memberof module:Threadify~threadify
  @function untilAnyway
  @instance
  @param {function} predicate - a function evaluates to truthy or falsy value
  @returns {promise} 
  */
  async untilAnyway (predicate) {
    if (predicate()) return
    return new Promise((resolve, reject) =>
      this._thrListeners.push({ predicate, resolve }))
  }

  /**
  The internal function calls all listeners when observable properties are set. It should NOT be called directly.
  @memberof module:Threadify~threadify
  @function updateListeners
  @instance
  */
  updateListeners () {
    this._thrListeners = this._thrListeners
      .reduce((arr, x) => (this.error && x.reject)
        ? K(arr)(x.reject(this.error))
        : x.predicate()
          ? K(arr)(x.resolve())
          : [...arr, x], [])
  }

  /**
  A convenience wrapper for given promise (async function) in async context. The wrapped promise will throw whenthis.error is set.

  Internally, settle logic is used for simplicity. If the race logic is used, the finally logic must be implemented in a much finer granularity.

  Example (in async class methods):
  ```
  await this.throwable(fs.lstatAsync(filePath)) 
  ```

  @memberof module:Threadify~threadify
  @function throwable
  @instance
  @param {promise} promise 
  @returns {promise} - wrapped promise
  */
  async throwable (promise) {
    let x = await promise
    if (this.error) throw this.error
    return x
  }

  /**
  A convenience wrapper for callback functions in callback or event handler context. When `this.error` is set, the wrapped function returns without calling the given function.

  @memberof module:Threadify~threadify
  @function guard
  @instance
  @param {function} f
  @returns {function} - wrapped function
  */
  guard (f) {
    return (...args) => {
      if (this.error) return
      try {
        f(...args)
      } catch (e) {
        this.error = e
      }
    }
  }

  abort() {
    this.error = this.EABORT
  }
}


