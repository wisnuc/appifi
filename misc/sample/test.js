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

  let m = 0
  [1, 2, 3].forEach(num => m = m + num)

lexical scope


nested function
  
  // context
  // deterministic / indeterministic

/// tick
/// 
const abortableReaddir = (arg1, callback) => {

  let aborted = false
 
  // function scope 

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

    process.nextTick(() => console.log('hello'))
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


class, new

{
  m: 1,
  print: function() {
    console.log(this.m)
  }
}

class Reader extends EventEmitter {

  constructor(arg) {
    this.arg = arg
    this.aborted = false


    this.on('readDirFinished', entries => {
    })
  }

  startAbortableReaddir () {
    fs.readdir(this.arg1, (err, entries) => {
      if (err) this.emit('err', err)
      else this.emit('readDirFinished', entries)
    }) 
  } 
}

function as a value,

function is the first class citizen.


let abort = abortableReaddir('tmptest', () => {})
setTimemout(() => abort(), 10)


step 1 => step 2 => step 3



setImmediate
process.nextTick
// concurent

// short job first

function myFunction(abspath, callback) {

  if (typeof abspath !== 'string') 
    return process.nextTick(() => callback(new Error('invalid path')))

  fs.readdir(abspath, (err, entries) => callback(err, entries))  
}

const abspath = 'tmptest'

myFunction(abspath, (err, entries) => console.log(err || entries))

console.log('hello')

abotrableReaddir(abspath, () => console.log('abortable'))

{
  let  m (volatile)


  xyz(() => { m = m  + 1 })

  race
}


for (let i = 0; i < 10; i++) {

  console.log({
    m: 1,
    y: 2
  })
}

function object
function call
  function scope
    x, y, z
    m, n
    o
  
compile time (source level)
runtime 

// imperative language
statement expression


function a(a1, a2) {
  let a3
  return
}

function b(b1, b2) {
  let b3
  a(a1, a2)
  return
}

b(1, 2)

/////////////////

a = func
b = func


//////////////////

function add(a, b) {
  return a + b
}

function print() {
  console.log(add(1, 2))
}

/////////////
memory allocation, stack machine



scatter, gather


























