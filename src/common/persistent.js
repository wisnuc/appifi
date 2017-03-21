const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp') 
const UUID = require('node-uuid')

// state: IDLE, PENDING, WIP
//
//                       NEWREQ                          TIMEOUT                   SUCCESS                              FAIL
// IDLE: nothing      -> PENDING with NEWREQ                        
// PENDING: req       -> re-TIMER and req with NEWREQ    -> WIP with req as req         
// WIP: req & next    -> next = NEWREQ                                             next ? -> PENDING with next as req   next ? -> PENDING with next as req
//                                                                                      : -> IDLE                            : -> PENDING with req as req

class State {

  constructor(ctx) {
    this.ctx = ctx
  }

  setState(nextState, ...args) {
    this.exit()
    this.ctx.state = new nextState(this.ctx, ...args)
  }

  exit() {}
}

class Idle extends State{

  save(data) {
    this.setState(Pending, data)
  }
}

class Pending extends State {

  constructor(ctx, data) {
    super(ctx)
    this.save(data)
  }

  save(data) {
    clearTimeout(this.timer)
    this.data = data 
    this.timer = setTimeout(() => {
      this.setState(Working, this.data) 
    }, this.ctx.delay)
  }
}

class Working extends State {

  constructor(ctx, data) { 
    super(ctx)
    this.data = data 

    // console.log('start saving data', data)

    let tmpfile = path.join(this.ctx.tmpdir, UUID.v4())
    fs.writeFile(tmpfile, JSON.stringify(this.data), err => {

      if (err) return this.error(err)
      fs.rename(tmpfile, this.ctx.target, err => {

        // console.log('finished saving data', data, err)

        if (err) return this.error(err)
        this.success()
      }) 
    })
  } 

  error(e) {

    console.log('error writing persistent file', e)

    if (this.next)    
      this.setState(Pending, this.next)
    else
      this.setState(Pending, this.data)
  }

  success() {
    if (this.next)
      this.setState(Pending, this.next)
    else 
      this.setState(Idle)
  }

  save(data) {
    // console.log('Working save', data)
    this.next = data
  }
}


class Persistent {

  constructor(target, tmpdir, delay) {

    this.target = target 
    this.tmpdir = tmpdir
    this.delay = delay || 500
    this.state = new Idle(this) 
  }

  save(data) {
    this.state.save(data)
  }
}

const createPersistent = (target, tmpdir, delay, callback) => {

  let targetDir = path.dirname(target)
  mkdirp(targetDir, err => {
    if (err) return callback(err)
    mkdirp(tmpdir, err => {
      if (err) return callback(err)
      callback(null, new Persistent(target, tmpdir, delay)) 
    })
  })
}

module.exports = createPersistent

