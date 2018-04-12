const EventEmitter = require('events')

class State {
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
    this.ctx.emit('State', this.constructor.name)
  }

  setState (NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args) 
  }

  enter () {}
  exit () {}

  get () {
  }

  set () {
  }

  next () {
    if (this.ctx.queue.length === 0) {
      this.setState(Idle)
    } else {
      this.setState(Saving)
    }
  }
}

class Loading extends State {

  enter () {
    let { filePath, tmpDir } = this.ctx

    mkdirp(tmpDir, err => {
      if (err) {
        this.setState(Failed, err)
      } else {
        fs.readFile(filePath, (err, buffer) => {
          if (err) {
            if (err.code === 'ENOENT') {
              this.ctx.data = null
              this.next()
            } else {
              this.setState(Failed, err)
            }
          } else {
            try {
              this.ctx.data = JSON.parse(buffer)
              this.next()
            } catch (e) {
              this.ctx.data = null 
              this.next()
            }
          }
        })
      }
    })      
  }

}

class Idle extends State {
  
  save () {
    this.setState(Saving)
  }
}

class Saving extends State {
  
  enter () {
    let { data, callback } = this.ctx.queue.shift()
    let tmpPath = path.join(this.ctx.tmpDir, UUID.v4())
    let filePath = this.ctx.filePath

    fs.writeFile(tmpPath, JSON.stringify(data, null, '  '), err => {
      if (err) {
        callback(err)         
        this.next()
      } else {
        fs.rename(tmpPath, filePath, err => {
          if (err) {
            callback(err)
            this.next()
          } else {
            this.ctx.data = data
            this.next()
          }
        })
      }
    }) 
  }

}

class FileStore extends EventEmitter {

  constructor(filePath, tmpDir) {
    this.dir = dir
    this.tmpDir = tmpDir

    this.filePath = filePath
    this.tmpDir = path.join(tmpDir, name)

    Object.defineProperty(this, 'data', {
      get () {
        return this._data
      },
      set (value) {
        let oldValue = this._data
        this._data = value
        process.nextTick(() => this.emit('Update', value, oldValue))
      }
    })

    this.queue = []
    new Loading(this)
  }

  save (data, callback) {
    this.queue.push({ data, callback })
    this.state.save()
  }
} 

module.exports = FileStore
