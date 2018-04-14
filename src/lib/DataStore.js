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
    this.ctx.emit('StateEntered', this.constructor.name)
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

  save () {}
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
}


/**
Load data from file
*/
class Loading extends State {

  enter () {
    this.prepareDirs(err => {
      if (err) return this.setState(Failed, err)
      fs.readFile(this.ctx.file, (err, buffer) => {
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
                if (typeof data !== object) throw new Error()
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
    let { file, dir, tmpDir } = this.ctx
    await mkdirpAsync(dir)
    await rimrafAsync(tmpDir)
    await mkdirpAsync(tmpDir)
  }

  prepareDirs (callback) {
    this.prepareDirsAsync()
      .then(() => callback())
      .catch(e => callback(e))
  }
}

/**
Idle state
*/
class Idle extends State {
  
  save () {
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

1. the ds object takes action as early as possible, aka, go to next state (which may also fire syscall)
2. the caller is serviced, since it is the reason!
3. the observer is serviced. This is guaranteed by using nextTick when emitting Update.

*/
class Saving extends State {
  
  enter () {
    let { file, tmpDir, queue } = this.ctx
    let { data, callback } = queue.shift()
    let tmpFile = path.join(tmpDir, UUID.v4())

    fs.writeFile(tmpFile, JSON.stringify(data, null, '  '), err => {
      if (err) {
        this.next()
        callback(err)         
      } else {
        fs.rename(tmpFile, file, err => {
          this.next()
          if (!err) this.ctx.data = data
          callback(err)
        })
      }
    }) 
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
  constructor(opts) {
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
    if (this.isArray && !Array.isArray(data)) {
      process.nextTick(() => callback(new Error('not an array')))
    } else if (!this.isArray && typeof data !== 'object') {
      process.nextTick(() => callback(new Error('not an object')))
    } else {
      this.queue.push({ data, callback })
      this.state.save()
    }
  }
} 

module.exports = DataStore
