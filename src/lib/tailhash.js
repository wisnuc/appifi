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
      highWaterMark: 16 * 1024 * 1024  // important for performance
    })
    .on('error', err => {
      console.log('tail hash error', err)
    })
    .on('data', data => {
      hash.update(data)
      totalRead += data.length
    })
    .on('end', () => {
      if (written === totalRead) {
        process.send(hash.digest('hex'), () => setTimeout(() => process.exit(), 5000))
      } else {
        setImmediate(Loop)
      }
    })

Loop()
`

// state 1: opening fd -> state 2: rs | ws && hashing
const pipeHash = (rs, fpath, callback) => {

  let finished = false
  let destroyed = false
  let fd, ws, hash

  const error = err => (destroy(), callback(err))
  const destroy = () => {
    if (destroyed || finished) return

    rs.removeListener('error', error)
    rs.on('error', () => {})

    if (fd !== undefined) {
      rs.unpipe()
      ws.removeAllListeners()
      ws.on('error', () => {})
      ws.destroy()
      hash.removeAllListeners()
      hash.on('error', () => {})
      hash.kill()
    } 

    destroyed = true
  }

  rs.on('error', error)
  fs.open(fpath, 'a+', (err, _fd) => {
    if (destroyed) return fs.close(_fd, () => {})
    if (err) return error(err)
    
    fd = _fd
    ws = fs.createWriteStream(null, { fd })
    ws.on('error', error)
    ws.on('finish', () => {
      finished = true
      hash.removeAllListeners()
      callback(null, { bytesWritten: ws.bytesWritten, hash })
    })

    const opts = { stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd]  }
    hash = child.spawn('node', ['-e', script], opts)
    hash.on('error', error)
    hash.on('message', () => 
      error(new Error(`unexpected message from child`)))
    hash.on('exit', (code, signal) => 
      error(new Error(`unexpected exit with code ${code} and signal ${signal}`)))
   
    rs.pipe(ws)    
  })

  return destroy
}

const drainHash = (hash, bytesWritten, callback) => {
  let finished = false
  let destroyed = false

  const error = err => (destroy(), callback(err))
  const destroy = () => {
    if (destroyed || finished) return
    hash.removeAllListeners()
    hash.on('error', () => {})
    hash.kill()
    destroyed = true
  }

  hash.on('error', error)
  hash.on('message', digest => {
    finished = true
    hash.removeAllListeners()
    hash.on('error', () => {})
    callback(null, digest)
  })
  hash.on('exit', (code, signal) => {
    error(new Error(`unexpected exit with code ${code} and signal ${signal}`))
  })

  hash.send(bytesWritten) 

  return destroy
}

module.exports = { pipeHash, drainHash }


