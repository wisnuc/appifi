const EventEmitter = require('events')

class State {
  
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
    this.ctx.emit(this.getState())
  }

  getState () {
    return this.constructor.name
  }

  setState (NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter () {
  }

  exit () {
  }

  init () {
  }

  importing () {
  }
}

class Probing extends State {

  enter () {
    this.probe(() => {
      if (this.ctx.admin) {
        if (this.ctx.bootable()) {
        } else {
        }
      } else {
         
      }
    })
  }

  probe () {
  }
}

class Pending extends State {
}

class Presetting extends State {
}

class Starting extends State {
}

class Started extends State {
}

class Unbootable extends State {
}

class Initializing extends State {
}

class Importing extends State {
}

class Boot extends EventEmitter {

  constructor () {
    super()
    this.load()
    this.state = new Probing(this)
  }

   
}





