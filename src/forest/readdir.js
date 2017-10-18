const debug = require('debug')('fruitmix:readdir')

const path = require('path')
const fs = require('fs')
const { readXstat } = require('../lib/xstat')
const Monitor = require('./monitor')

/**
`readdir` reads the contents of directories and updates `Directory` children and mtime accordingly.

`readdir` is implemented in state machine pattern. There are three states defined:
+ Idle
+ Pending
+ Working

@module readdir
*/

/**
Idle State
*/
class Idle {

  /**
  @param {Directory} dir - directory object
  */
  constructor (dir) {
    /**
    hosting directory object
    */
    this.dir = dir

    debug(`${dir.name} enter idle`)
  }

  /** Implement `read` virtual method, see `Directory` for definition. */
  read (handler) {
    if (Number.isInteger(handler)) {
      this.dir.readdir = new Pending(this.dir, handler)
    } else if (typeof handler === 'function' || handler instanceof Monitor) {
      this.dir.readdir = new Working(this.dir, [handler])
    } else if (handler === undefined) {
      this.dir.readdir = new Working(this.dir, [])
    } else {
      throw new Error('invalid handler')
    }
  }

  /**
  Abort. Do nothing.
  */
  abort () {
  }

}

/**
Pending State
*/
class Pending {

  /**
  @param {Directory} dir - directory object
  @param {number} delay - time to delay, in ms.
  */
  constructor (dir, delay) {
    if (!Number.isInteger(delay) || delay < 0) { throw new Error('invalid delay argument') }

    /**
    hosting directory object
    */
    this.dir = dir

    this.timer = -1
    this.read(delay)

    debug(`${dir.name} enter pending`)
  }

  /** Implement `read` virtual method, see `Directory` for definition. */
  read (handler) {
    clearTimeout(this.timer)
    if (Number.isInteger(handler)) {
      this.timer = setTimeout(() => {
        this.dir.readdir = new Working(this.dir)
      }, handler)
    } else if (typeof handler === 'function' || handler instanceof Monitor) {
      this.dir.readdir = new Working(this.dir, [handler])
    } else if (handler === undefined) {
      this.dir.readdir = new Working(this.dir, [])
    } else {
      throw new Error('invalid handler')
    }
  }

  /** Abort. Clear timer. **/
  abort () {
    clearTimeout()
  }

}

/**
Working state
*/
class Working {

  /**
  There are two ways to perform a `readdir` operation.

  When `handlers` is provided, readdir operation should performed anyway without checking timestamp. `handlers` may be an empty array when state transferred from the idle state triggered by a `read` event without a handler.
  When `handlers` not provided, the operation is considered to be a suspicious check. This happens when state transferred from the pending state triggered by a timeout. The timestamp should be checked first. And if it matches, no readdir operation will be performed. 

  @param {Directory} dir - directory object
  @param {Array} [handlers] - an array of handlers to be serviced by this instance
  */
  constructor (dir, handlers) {
    /**
    hosting directory object
    */
    this.dir = dir

    /**
    comparing timestamp or not
    */
    this.compareTimestamp = !handlers

    /**
    handlers to be serviced by this operation
    @type {Array}
    */
    this.handlers = handlers || []

    // tell monitors a readdir starts
    this.handlers
      .filter(h => h instanceof Monitor)
      .forEach(h => h.start(this.dir.uuid, this.dir.name))

    /**
    `pending` queues all incoming read requests during `readdir` operation. 
    If all requests are deferred, `pending` is the minimum delay. If some are immediate, it's handler array.
    @type {(number|Array)}
    */
    this.pending = undefined

    /**
    Keep a copy of directory's abspath before `readdir` for detecting race. 
    */
    this.dirPath = this.dir.abspath()

    this.start()

    debug(`${dir.name} enter working`)
  }

  /**
  Check if the given error is a path error
  @param {error} err
  */
  isPathError (err) {
    return ['ENOENT', 'ENOTDIR', 'EINSTANCE', 'EINTERRUPTED'].includes(err.code)
  }

  /**
  Decorate `statusCode: 503` to path error
  @param {error} err
  */
  decorate (err) {
    if (this.isPathError(err)) err.statusCode = 503
  }

  /**
  Request immediate `read` on all ancestors along node path (exclusive).
  */
  fixPath () {
    // ancestors (exclusive)
    let ancestors = []
    for (let n = this.dir.parent; n !== null; n = n.parent) ancestors.unshift(n)
    ancestors.forEach(n => n.read())
  }

  /**
  Handle `readdir` result. This function is used by `start` as callback.

  @param {error} err
  @param {xstat[]} xstats
  @param {number} mtime 
  @param {boolean} transient
  */
  finish (err, xstats, mtime, transient) {
    if (this.finished) return

    this.finished = true

    // detect race, dir name change is included in path change
    if (this.dirPath !== this.dir.abspath()) {
      err = new Error('path changed during readdir operation')
      err.code = 'EINTERRUPTED'
    }

    debug(`${this.dir.name} working finished`)

    // processing error or result
    if (err) {
      this.decorate(err)

      if (this.isPathError(err)) {
        this.fixPath()
        this.read()
      } else {
        // schedule a read TODO backoff
        this.read(150)
      }
    } else if (xstats) {
      if (mtime !== this.dir.mtime) { this.dir.merge(xstats, this.handlers.filter(h => h instanceof Monitor)) }

      if (mtime !== this.dir.mtime && transient === false) { this.dir.mtime = mtime }

      if (transient) this.read(150)
    }

    // process handlers
    this.handlers.forEach(handler => {
      if (typeof handler === 'function') { handler(err, xstats) }
      if (handler instanceof Monitor) { handler.end(this.dir.uuid, this.dir.name) }
    })

    debug(`${this.dir.name} working next`, this.pending, transient)

    if (Array.isArray(this.pending)) {
      this.dir.readdir = new Working(this.dir, this.pending)
    } else if (typeof this.pending === 'number' || (xstats && transient)) {
      this.dir.readdir = new Pending(this.dir, this.pending, Math.min(this.pending, 150))
    } else {
      this.dir.readdir = new Idle(this.dir)
    }
  }

  /**
  Read xstats of all files in the given directory. Only regular files and directories are read. 
  @param {function} callback - `(err, xstats)`
  */
  readXstats (callback) {
    fs.readdir(this.dirPath, (err, entries) => {
      if (this.finished) return
      if (err) return callback(err)
      if (entries.length === 0) return callback(null, [])

      let xstats = []
      let count = entries.length
      entries.forEach(ent => {
        let entPath = path.join(this.dirPath, ent)
        readXstat(entPath, (err, xstat) => {
          if (this.finished) return
          if (!err) xstats.push(xstat)
          if (!--count) {
            xstats.sort((a, b) => a.name.localeCompare(b.name))
            callback(null, xstats)
          }
        })
      })
    })
  }

  /**
  start the `read` operation
  */
  start () {
    readXstat(this.dirPath, (err, xstat1) => {
      if (this.finished) return
      if (err) return this.finish(err)
      if (xstat1.type !== 'directory') {
        this.finish(Object.assign(new Error('not a dir'), { code: 'ENOTDIR' }))
        return
      }

      if (xstat1.uuid !== this.dir.uuid) {
        this.finish(Object.assign(new Error('uuid mismatch'), { code: 'EINSTANCE' }))
        return
      }

      if (this.compareTimestamp && xstat1.mtime === this.dir.mtime) {
        this.finish(null)
      }

      this.readXstats((err, xstats) => {
        if (this.finished) return
        if (err) return this.finish(err)
        readXstat(this.dirPath, (err, xstat2) => {
          if (this.finished) return
          if (err) return this.finish(err)
          if (xstat2.type !== 'directory') {
            this.finish(Object.assign(new Error('not a dir'), { code: 'ENOTDIR' }))
            return
          }

          if (xstat2.uuid !== this.dir.uuid) {
            this.finish(Object.assign(new Error('uuid mismatch'), { code: 'EINSTANCE' }))
            return
          }

          this.finish(null, xstats, xstat2.mtime, xstat2.mtime !== xstat1.mtime)
        })
      })
    })
  }

  /** 
  implement `read` virtual method 
  @param {undefined|number|function|Monitor} handler
  */
  read (handler) {
    if (handler instanceof Monitor) { handler.start(this.dir.uuid, this.dir.name) }

    if (Number.isInteger(handler)) {
      if (this.pending === undefined) {
        this.pending = handler
      } else if (typeof this.pending === 'number') {
        this.pending = Math.min(this.pending, handler)
      } else if (Array.isArray(this.pending)) {
      } else {
        throw new Error('invalid pending type')
      }
    } else if (typeof handler === 'function' || handler instanceof Monitor) {
      if (this.pending === undefined) {
        this.pending = [handler]
      } else if (typeof this.pending === 'number') {
        this.pending = [handler]
      } else if (Array.isArray(this.pending)) {
        this.pending.push(handler)
      } else {
        throw new Error('invalid pending type')
      }
    } else if (handler === undefined) {
      if (this.pending === undefined) {
        this.pending = []
      } else if (typeof this.pending === 'number') {
        this.pending = []
      } else if (Array.isArray(this.pending)) {
      } else {
        throw new Error('invalid pending type')
      }
    } else {
      throw new Error('invalid handler')
    }

    // console.log('readdir read, working', handler, this.pending)
  }

  /** 
  implement `abort` virtual method
  */
  abort () {
    if (this.finished) return

    this.finished = true
    let err = new Error('aborted')
    err.code = 'EABORT'
    err.statusCode = 503

    this.handlers.forEach(handler => {
      if (typeof handler === 'function') {
        handler(err)
      }
      if (handler instanceof Monitor) {
        handler.end(this.dir.uuid, this.dir.name, err)
      }
    })
  }

}

/**
Construct a `readdir` state machine, starting from `Working` state.

@param {Directory} dir - Directory object
*/
const readdir = (dir, monitors) => new Working(dir, monitors || [])

module.exports = readdir
