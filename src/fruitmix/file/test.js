import path from 'path'
import fs from 'fs'
import EventEmitter from 'events'
import child from 'child_process'


/**
// Event Model

// Observable
Object A                     Observer B
  observer ---->               1. method name (handle
                               2. message / action object
                               3. by parameters

                             Observer C
     

life cycle

state

 external controll for node

procedure

 start, stop, (transient state)

  handle init -> running -> timeout
                  -> finish

  let handle = request.post(url)            // builder
    .set('Accept', 'application/json')
    .set('Authorization', 'JWT xxxxx')
    .post({
      username: 'hello',
      password: 'world',
    })
    .end((err, res) => {
      handle = null    
      xxxx
    })

  setTimerout(() => {
    if (handle) handle.abort()
    handle = null
  }, 3000)

**/

class Hasher extends EventEmitter {

  constructor(abspath) {

    super()
    this.abspath = abspath
    this.state = null

    // the following state are specific to 'started' state
    this.callback = null
    this.spawn = null
    this.data = null

    this.handleStdout = data => {
      if (this.state === 'started')
        this.data = data.toString().split(' ')[0]
    }

    this.handleError = err => {
      if (this.state === 'started') {
        this.exitStarted(err)
      }
    }

    this.handleClose = code => {

      if (this.state === 'started') {
        let err, data
        if (code !== 0) 
          err = Object.assign(new Error('non zero exit code'), { code: 'EEXITERROR' })
        else if (test(this.data)) 
          err = Object.assign(new Error('bad formatted'), { code: 'EBADFORMAT' })
        else
          data = this.data
      
        this.exitStarted(err, data) 
      }
    }
  }

  enterStarted(callback) {
    
    this.state = 'started'
    this.callback = callback
    // openssl dgst -sha256 -r 20141213.jpg
    this.spawn = child.spawn('openssl', ['dgst', '-sha256', '-r', this.abspath])
    this.spawn.stdout.on('data', this.handleStdout)
    this.spawn.on('close', this.handleClose)
  }

  exitStarted(err, data) {

    this.callback(err, data)
    this.callback = null
    this.spawn.kill()
    this.spawn = null
    this.state = 'stopped'
  }

  // jslint, eslint
  setState(nextState) {
    if (currState) {
      switch (currState) {
      case 'STATE1': 
        this.state1Exit()
      case 'STATE2':
        this.state2Exit()
      default:
      }
    }

    switch(nextState) {
    case 'STATE1':
      this.state1Enter()
    case 'STATE2':
      this.state2Enter()
    default:
    }
  }

  start(callback) {
    this.enterStarted(callback)
  }

  abort() {
    if (this.state === 'started') {
      this.exitStarted(Object.assign(new Error('aborted'), { code: 'EABORT' }))
    }
  }
}

///////////////////////////////////////////////////////////////////////


              Forest                                Digest / Media

thumbnail     node.startThumbnailer     <-- 50/s    [buffer] <==== 5000 / s



Forest.requestThumbnail(uuid) 
node.startThumbnail()




handle = node.startThumbnailer()
handle.on('finish', (err, data) => {
})

handle = node.startThumbnailer(xxxx, 
  (err, data) => {
})

handle: {
  node: 
  
}

///////////////////////////////////////////////////////

  queue = []

  while (1) {
    if (queue.length === 0) process.exit() 
    
    let task = queue.shift()
    task.run() => func(err, entries)
  }

// class object, closure

  task = creatTask()
  task.state = 'pending'
  task.state = 'ready'
  // libuv, thread poll, readdir

  // context
  // deterministic / indeterministic
const abortableReaddir = (arg1, callback) => {

  let aborted = false
  
  // non-blocking
  fs.readdir(arg1, (err, entries) => {

    if (aborted) return 
    if (err) return

    let count = entries.length
    if (count === 0) return

    entries.forEach(entry => {
      fs.stat(path.join(arg1, entry), (err, stats) => {
        if (aborted) {}
        else console.log(err || stats)
      })
    })
  })

  return {
    path: 
    abort: () => {}
  }

  return () => {
    let err = new Error('aborted')
    err.code = 'EABORT'
    callback(err)
    aborted = true
  }
}

let abort = abortableReaddir('tmptest', () => {})
setTimemout(() => abort(), 10)

// concurent

// short job first
















