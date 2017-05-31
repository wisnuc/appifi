let updateSambaFilesAsync = require('./updateSamba')
let DEFAULT_DELAY = require('./config').DEFAULT_DELAY
let RETRY_TIMES = require('./config').RETRY_TIMES

import Debug from 'debug'
const SAMBA_MANAGER = Debug('SAMBA:SAMBA_MANAGER')

// stat/event    new request (file change)                 timeout                success                        fail
// init                                                                           idle                           exit
// idle          wait (current req)
// wait          wait (re-timer & req with next new req)   update (current req)    
// update        update (save new req as next req)                                next ? wait(next req) : idle   counter > 3 ? (next ? wait(next req) : idle) : counter + 1 & update (current req)
// exit

class State {
  constructor(contents) {
    this.contents = contents
  }

  setState(nextState, ...args) {
    this.contents.state = new nextState(this.contents, ...args)
  }
}

class Idle extends State{
  constructor(contents, data) {
    super(contents)
    this.enter()
  }

  resetSamba(data) {
    this.exit()
    this.setState(Wait, data)
  }

  enter() {
    // SAMBA_MANAGER('Enter Update')
  }

  exit() {
    // SAMBA_MANAGER('Leave Update')
  }
}

class Wait extends State {
  constructor(contents, data) {
    super(contents)
    this.enter()
    this.resetSamba(data)
  }

  resetSamba(data) {
    clearTimeout(this.timer)
    this.data = data
    this.timer = setTimeout(() => {
      this.exit()
      this.setState(Update, this.data) 
    }, this.contents.delay)
  }

  enter() {
    // SAMBA_MANAGER('Enter Wait')
  }

  exit() {
    // SAMBA_MANAGER('Leave Wait')
    clearTimeout(this.timer)
  }
}

class Update extends State {
  constructor(contents, data) { 
    super(contents)
    this.contents.counter = 0
    this.enter()
    updateSambaFilesAsync().then(() => {
      SAMBA_MANAGER(data)
      this.success()
    }).catch(err => {
      SAMBA_MANAGER(err)
      this.error()
    })
  }

  resetSamba(data) {
    this.next = data
  }

  success() {
    if (this.next) {
      this.exit()
      this.setState(Wait, this.next)
    }
    else {
      this.exit()
      this.setState(Idle)
    }
  }

  error() {
    this.contents.counter += 1
    if(this.contents.counter >= RETRY_TIMES) {
      if (this.next) {
        this.exit()
        this.setState(Wait, this.next)
      }
      else {
        this.exit()
        this.setState(Idle)
      }
    }
    else {
      updateSambaFilesAsync().then(() => {
        SAMBA_MANAGER(data)
        this.success()
      }).catch(err => {
        SAMBA_MANAGER(err)
        SAMBA_MANAGER('Retry... ...')
        this.error()
      })
    }
  }

  enter() {
    // SAMBA_MANAGER('Enter Update')
  }

  exit() {
    // SAMBA_MANAGER('Leave Update')
  }
}

class SambaManager {
  constructor(delay, echo) {
    this.delay = delay || DEFAULT_DELAY
    this.state = new Idle(this) 
  }

  resetSamba(echo) {
    this.state.resetSamba(echo)
  }
}

module.exports = SambaManager