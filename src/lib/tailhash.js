const path = require('path')
const fs = require('fs')
const child = require('child_process')
const EventEmitter = require('events')
const debug = require('debug')('hash-stream')

const script = `
const fs = require('fs')
const hash = require('crypto').createHash('sha256')

let ended = false
let finished = false
let length = 0
let totalRead = 0
let buffers = []

process.on('message', message => {
  if (message === 'exit') {
    process.exit(0)
  } else if (message === 'end') {
    ended = true 
  } else if (typeof message === 'number') {
    length = message  
  } else {
    process.exit(119)
  }
})

const readLoop = () => {
  if (length === totalRead) {
    if (ended) {
      finished = true // break loop
    } else {
      setImmediate(readLoop)
    }
    return
  }

  let len = length - totalRead 
  let buf = Buffer.allocUnsafe(len)
  fs.read(4, buf, 0, len, totalRead, (err, bytesRead, buffer) => {
    if (err) process.exit(119)
    if (bytesRead !== 0) {
      totalRead += bytesRead
      buffers.push(buffer.slice(0, bytesRead))
    } 
    setImmediate(readLoop) 
  })
}

const hashLoop = () => {
  if (buffers.length === 0) {
    if (finished) {
      process.send(hash.digest('hex'))
      setTimeout(() => {
        process.exit(120) 
      }, 60 * 1000)
    }
  } else {
    buffers.forEach(buf => hash.update(buf))
    buffers = []
  }
  setImmediate(hashLoop)
}

readLoop()
hashLoop()
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
      // rs.unpipe()
      rs.removeAllListeners('data')
      rs.removeAllListeners('end')
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
   
    rs.on('data', data => ws.write(data, () => hash.send(ws.bytesWritten)))
    rs.on('end', () => ws.end())
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
  hash.send('end')
  return destroy
}

module.exports = { pipeHash, drainHash }


