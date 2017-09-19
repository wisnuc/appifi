const path = require('path')
const fs = require('fs')
const child = require('child_process')
const EventEmitter = require('events')
const debug = require('debug')('hash-stream')

const script = `
const fs = require('fs')
const hash = require('crypto').createHash('sha256')

let totalRead = 0, written = -1

process.on('message', message => written = message)

const Loop = () => fs.createReadStream(null, { 
      fd: 4, 
      autoClose: false, 
      start: totalRead, 
      highWaterMark: 16 * 1024 * 1024 
    })
    .on('data', data => (hash.update(data), totalRead += data.length))
    .on('end', () => written === totalRead 
      ? process.send(hash.digest('hex'), () => process.exit())
      : setImmediate(Loop))

Loop()
`

/**

States:

    -----------------------------------------------
    ^                                             |(1)
    |                                       (2)   v
  started -- (error, destroy) --> destroying -> exited <----
    |                                             ^      (4)|
    |                                          (3)|         |
  (end)                                           |         |
    |                                             |         |
    v                                             |         |
  ended   -- (error, destroy) --> destroying ------         |
    |                                                       |
    ---------------------------------------------------------

  started:
    exited = false
    ended = false
    destroyed = false (no differnece between destroyed and errored)
    
  started -> destroyed
    exited = false 
    ended = falsed
    destroyed = true

  started -> ended
    exited = false
    ended = true
    destroyed = false

  started -> ended -> destroyed
    exited = false
    ended = true
    destroyed = true

  exited (exited = true)
    1. ended = false, destroyed = false 
    2. ended = false, destroyed = true
    3. ended = true, destroyed = true
    4. ended = true, destroyed = false
      (1) digest, success
      (2) no digest, fail


From view point of external component, two destroying states can be combined.
There is no difference between ended or not ended states.

**/
class TailHash extends EventEmitter {

  constructor (fd) {
    super()
    this.exited = false
    this.ended = false
    this.destroyed = false

    const opts = {
      stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd]  
    }

    this.spawn = child.spawn('node', ['-e', script], opts)

    // effective only when normal
    this.spawn.on('error', err => {
      if (!exited && !destroyed) {
        spawn.removeAllListeners
      }  
    })

    this.spawn.on('message', message => {
    })

    this.spawn.on('finish', () => {
    })
  }

  destroy () {
    if (this.destroyed === true) {
      console.log('WARNING: tailhash is destroyed more than once')
      return
    }

    this.destroyed = true
    
  }
}

const tailHash = (fd, callback) => {
  
  const opts = {
    stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd]  
  }

  const spawn = child.spawn('node', ['-e', script], opts)
  spawn.on('error', err => {
    spawn.removeAllListeners()
    spawn.kill()  
    spawn = null
    this.emit('error', err)
  })

  spawn.on('exit', (code, signal) => {
    spawn.removeAllListeners()
    spawn = null
    if (code) {
    } else if (
  })

  spawn.on('message', digest => {
  })

  end(bytesWritten) {
  }
}

const createPipeHash = (rs, fpath, callback) => {

  let destroyed = false
  let fd, ws, child

  const destroy = () => {
    rs.removeListener('error', onError)
    rs.on('error', () => {})

    if (fd !== undefined) {
      rs.unpipe()

      ws.removeListener('error', onError)
      ws.removeListener('finish', onFinish)
      ws.on('error', () => {})
      ws.destroy()

      child.removeListener('error', onError)
      child.removeListener('message', childOnMessage)
      child.removeListener('exit', childOnExit)
      child.on('error', () => {})
      child.kill()
    } 

    destroyed = true
  }

  const onError = err => {
    destroy()
    callback(err)
  }
    
  const rsOnError = err => destroy(err)
  const wsOnError = err => destroy(err)
  const childOnError = err => destroy(err)

  const wsOnFinish = () => {
  }

  rs.on('error', rsOnError)

  fs.open(fpath, (err, _fd) => {
    if (destroyed) {
      fs.close(_fd, () => {})
      return
    } 

    

    if (err) return callback(err) 
    
    let ws = fs.createWriteStream(null, { fd })
    ws.on('error', err => {})
    ws.on('finish', () => {
      bytesWritten: ws.bytesWritten
      child,      
    })
   
    let child = spawn 

    child.on('error', () => {})
    child.on('exit', () => {})

    
  })

  // destroy
  return () => {
    if (destroyed) return 
    if (!fd) {
      
    } else {

    }
  }
}


module.exports = fd => child.spawn('node', ['-
