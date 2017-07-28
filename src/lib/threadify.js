const Promise = require('bluebird')
const stream = require('stream')
const debug = require('debug')('threadify')

const K = x => y => x

const threadify = base => class extends base {
  constructor (...args) {
    super(...args)
    this._thrListeners = []
  }

  /**
  value is optional
  set is optional
  **/
  observe (name, value, set) {
    let _name = '_' + name
    this[_name] = value
    Object.defineProperty(this, name, {
      get: function () {
        return this[_name]
      },
      set: set || function (x) {
        if (this[_name]) return
        debug('observe set', name,
          x instanceof stream
            ? 'stream'
            : Array.isArray(x)
              ? 'array length ' + x.length
              : x)
        this[_name] = x
        process.nextTick(() => this.updateListeners())
      }
    })
  }

  async until (predicate) {
    if (predicate()) return
    return new Promise((resolve, reject) =>
      this._thrListeners.push({ predicate, resolve, reject }))
  }

  async untilAnyway (predicate) {
    if (predicate()) return
    return new Promise((resolve, reject) =>
      this._thrListeners.push({ predicate, resolve }))
  }

  updateListeners () {
    this._thrListeners = this._thrListeners
      .reduce((arr, x) => (this.error && x.reject)
        ? K(arr)(x.reject(this.error))
        : x.predicate()
          ? K(arr)(x.resolve())
          : [...arr, x], [])
  }

  async throwable (promise) {
    let x = await promise
    if (this.error) throw this.error
    return x
  }

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
}

module.exports = threadify
