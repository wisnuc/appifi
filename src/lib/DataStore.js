const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const UUID = require('uuid')

class State {

  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)

    // Emitting StateEntered in nextTick guarantees
    // 1. the first event won't miss
    // 2. for synchronous and continuous state transition, the order is in calling order rather than
    // the order of unwinding stack.
    process.nextTick(() => this.ctx.emit('StateEntered', this.constructor.name))
  }

  setState (NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter () {}
  exit () {}

  next () {
    if (this.ctx.queue.length === 0) {
      this.setState(Idle)
    } else {
      this.setState(Saving)
    }
  }

  save (data, callback) {
    if (this.destroying) return callback(new Error('store being destroyed'))

    if (typeof data !== 'function') {
      if (this.ctx.isArray && !Array.isArray(data)) {
        return process.nextTick(() => callback(new Error('not an array')))
      } else if (!this.ctx.isArray && typeof data !== 'object') {
        return process.nextTick(() => callback(new Error('not an object')))
      }
    }

    this.ctx.queue.push({ data, callback })
  }

  destroy (callback) {
    this.setState(Destroyed, [callback])
  }

}

/**
Failed state
*/
class Failed extends State {

  /**
  Enter state
  @param {Error} err - err object
  */
  enter (err) {
    this.err = err
  }

  save (data, callback) {
    process.nextTick(() => callback(new Error('store is failed')))
  }

}

/**
Load data from file
*/
class Loading extends State {

  enter () {
    this.prepareDirs(err => {
      if (this.destroying) return this.setState(Destroyed, this.destroyCallback)
      if (err) return this.setState(Failed, err)
      fs.readFile(this.ctx.file, (err, buffer) => {
        if (this.destroying) return this.setState(Destroyed, this.destroyCallback)
        if (err && err.code !== 'ENOENT') {
          this.setState(Failed, err)
        } else {
          if (err) {
            this.ctx.setEmpty()
          } else {
            try {
              let data = JSON.parse(buffer)
              if (this.ctx.isArray) {
                if (!Array.isArray(data)) throw new Error()
              } else {
                if (typeof data !== 'object') throw new Error()
              }
              this.ctx.data = data
            } catch (e) {
              this.ctx.setEmpty()
            }
          }
          this.next()
        }
      })
    })
  }

  async prepareDirsAsync () {
    let { dir, tmpDir } = this.ctx
    await mkdirpAsync(dir)
    await rimrafAsync(tmpDir)
    await mkdirpAsync(tmpDir)
  }

  prepareDirs (callback) {
    this.prepareDirsAsync()
      .then(() => callback())
      .catch(e => callback(e))
  }

  destroy (callback) {
    if (this.destroying) {
      this.destroyCallbacks.push(callback)
    } else {
      this.destroying = true
      this.destroyCallbacks = [callback]
    }
  }

}

/**
Idle state
*/
class Idle extends State {

  save (data, callback) {
    super.save(data, callback)
    this.setState(Saving)
  }

}

/**
Save data to file, update data prop if succeeded

This state proposes an interesting problem of sequence.

When a data is successfully updated:
1. the ds object should enter next state;
2. the save callback should be returned;
3. the observer should be notified if any;

Note that the saver and observer are blackbox user, there is no state protocol to them.
The promises to them are:
1. the value is sucessfully updated and saved to file at the moment;
2. if the caller or observer access the ds.data synchronously, they should be the same value they provided or being provided;

The ds has asynchronous nature and decides the action on its own, as long as the above promise is fulfilled.

So we adopt an aggressive policy as most node.js codes do.

0. the value must be updated first, since in the following step this value may be used.
1. the ds object takes action as early as possible, aka, go to next state (which may also fire syscall)
2. the caller is serviced, since it is the reason!
3. the observer is serviced. This is guaranteed by using nextTick when emitting Update.

*/
class Saving extends State {

  enter () {
    this.job = this.ctx.queue.shift()

    if (typeof this.job.data === 'function') {
      try {
        this.job.data = this.job.data(this.ctx.data)

        // if the function returns the same data, this is a retrieve/save job
        if (this.job.data === this.ctx.data) {
          this.job.callback(null, this.ctx.data)
          this.next()
          return
        }
      } catch (e) {
        this.job.callback(e)
        this.next()
        return
      }
    }

    this.write(this.job.data, err => {
      if (this.destroying) return this.setState(Destroyed, this.destroyCallbacks)
      if (err) {
        this.job.callback(err)
        this.next()
      } else {
        this.ctx.data = this.job.data
        this.job.callback(null, this.ctx.data)
        this.next()
      }
    })
  }

  // utility function
  write (data, callback) {
    let { file, tmpDir } = this.ctx
    let tmpFile = path.join(tmpDir, UUID.v4())
    fs.writeFile(tmpFile, JSON.stringify(data, null, '  '), err => err
      ? callback(err)
      : fs.rename(tmpFile, file, callback))
  }

  destroy (callback) {
    if (this.destroying) {
      this.destroyCallbacks.push(callback)
    } else {
      let err = new Error('store being destroyed')
      this.job.callback(err)
      this.ctx.queue.forEach(j => j.callback(err))
      this.ctx.queue = []
      this.destroying = true
      this.destroyCallbacks = [callback]
    }
  }

}

/**
Destroyed state
*/
class Destroyed extends State {

  enter (callbacks) {
    process.nextTick(() => callbacks.forEach(cb => cb && cb()))
  }

  save (data, callback) {
    process.nextTick(() => callback(new Error('store is destroyed')))
  }

  destroy (callback) {
    process.nextTick(() => callback())
  }

}

/**
DataStore stores a JavaScript object in file system.

It requires a file path and a temp dir path to work. The temp dir is re-created at first, so to avoid conflict, each data store should have it's own temp dir.

The file and tmp dir should located at the same file system.

The data can be an object or an array, but not a primitive value.  For object, the null value is `null`. For array, the null value is `[]`.

When constructed, the data prop is set to undefined.

*/
class DataStore extends EventEmitter {

  /**
  Creates an data store

  @param {object} opts
  @param {string} opts.file - file to store the object
  @param {string} opts.tmpDir - directory to creat tmp file
  @param {boolean} opts.isArray - treat the object as an array
  */
  constructor (opts) {
    super()

    let { file, tmpDir, isArray } = opts

    this.file = file
    this.dir = path.dirname(file)
    this.tmpDir = tmpDir
    this.isArray = !!isArray

    this._data = undefined
    Object.defineProperty(this, 'data', {
      get () {
        return this._data
      },
      set (data) {
        let oldData = this._data
        this._data = data
        process.nextTick(() => this.emit('Update', data, oldData))
      }
    })

    this.queue = []
    new Loading(this)
  }

  stateName () {
    return this.state.constructor.name
  }

  setEmpty () {
    this.data = this.isArray ? [] : null
  }

  save (data, callback) {
    this.state.save(data, callback)
  }

  // callback is optional
  destroy (callback) {
    this.state.destroy(callback)
  }

}

module.exports = DataStore
