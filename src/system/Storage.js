const EventEmitter = require('events')

const { probe, mkfsBtrfs } = require('./storage')

/**
Storage wraps and synchronizes all disk operations, including:
1. probe storage
2. probe data volume
3. initialize data volume
4. import data volume
5. repair data volume

@module Storage
*/

class State {
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  setState(State, ...args) {
    this.exit()
    new State(...args)
  }

  enter () {
  }

  exit () {
  }
}

class Idle extends State {

}

class Pending extends State {

}

class Initializing extends State {

}

class Importing extends State {
}

class Storage extends EventEmitter {

  constructor () {
    new Probing(this)
  }
}

module.exports = Storage
