const path = require('path')
const fs = require('fs')
const child = require('child_process')
const EventEmitter = require('events')
const os = require('os')
const crypto = require('crypto')
const cryptoAsync = require('@ronomon/crypto-async')

const rimraf = require('rimraf')
const debug = require('debug')('HashStream')

const script = `
const fs = require('fs')
const hash = require('crypto').createHash('sha256')

let ended = false
let finished = false
let length = 0
let totalRead = 0
let buffers = []

process.on('message', message => {
  if (message === 'end') {
    ended = true 
  } else if (typeof message === 'number') {
    length = message  
  } else {
    process.exit(118)
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
  if (len > 4 * 1024 * 1024) len = 4 * 1024 * 1024
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
      setTimeout(() => process.exit(120), 32000)
      return
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

/*******************************************************************************
  
There are two ways to calculate hash, in-process (ip) or using child process 
(cp) to offload main thread.

The incoming request may provide sha256 value in advance (pre), or it may append 
the value right after the stream (post).

So the combinations are:
1. ip-pre
2. cp-pre
3. ip-post
4. cp-post

in pre mode, digest is calculated when read stream ends.
in post mode, digest is received from hash stream.

(1) ip-pre:

S   rs  ws  hash  digest  sha256
1   Y                     Y
2   Y   Y   Y             Y
3       Y         Y       Y
4                 Y       Y

(2) ip-post

S   rs  ws  hash  digest  sha256
1   Y
2   Y   Y   Y      
3       Y         Y       
4                 Y       Y

(3) cp-pre:

S   rs  ws  hs    digest  sha256
1   Y                     Y
2   Y   Y   Y             Y
3       Y   Y             Y
4           Y             Y
5                 Y       Y

(4) cp-post:
S   rs  ws  hs    digest  sha256
1   Y
2   Y   Y   Y
3       Y   Y             Y
4           Y             Y
5                 Y       Y

**/

/**
(1) ip-pre:

S   rs  ws  hash  digest  sha256
1   Y                     Y
2   Y   Y   Y             Y
3       Y         Y       Y
4                 Y       Y
*/
class IPre extends EventEmitter {

  constructor(rs, filePath, size, sha256) {
    super() 

    debug('constructing ipre')
    
    this.rs = rs
    this.path = filePath
    this.size = size
    this.sha256 = sha256

    this.bytesRead = 0
    this.ws = null
    this.hash = null

    fs.open(this.path, 'w+', (err, fd) => {
      if (this.isFinished()) {
        if (!err) fs.close(fd, () => {})
        return
      }

      if (err) return this.error(err)

      this.ws = fs.createWriteStream(null, { fd })
      this.ws.on('error', err => this.error(err))
      this.ws.on('finish', () => {
        if (this.ws.bytesWritten !== this.size) {
          this.error('bytesWritten different than expected size')
        } else {
          this.ws = null
          this.emit('finish')
        }
      })

      this.hash = crypto.createHash('sha256')

      this.rs.on('error', err => this.error(err)) 
      this.rs.on('data', data => {
        this.bytesRead += data.length
        if (this.bytesRead > this.size) {
          let err = new Error('more data read than expected size')
          err.code = 'EOVERSIZE'
          this.error(err)
        } else {
          this.hash.update(data)
          this.ws.write(data)
        }
      })
      this.rs.on('end', () => {
        if (this.bytesRead < this.size) {
          let err = new Error('less data read than expected size')
          err.code = 'EUNDERSIZE'
          this.error(err)
        } else {
          let digest = this.hash.digest('hex')
          if (digest !== this.sha256) {
            let err = new Error('sha256 mismatch')
            err.code = 'ESHA256MISMATCH'
            this.error(err)
          } else {
            this.digest = digest
            this.rs = null
            this.hash = null

            // this may trigger write stream finished synchronously!
            this.ws.end()
          }
        }
      })
    })
  }

  readFinished () {
    return this.rs === null
  }

  isFinished () {
    return !this.rs && !this.ws
  }

  destroy() {
    if (this.rs && !this.ws) {            // S1: opening file
      this.rs.removeAllListeners() 
      this.rs.on('error', () => {})
      this.rs = null
    } else if (this.rs && this.ws) {      // S2: piping
      this.rs.removeAllListeners()
      this.rs.on('error', () => {})
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws.destroy()
      this.rs = null
      this.ws = null
      this.hash = null
    } else if (!this.rs && this.ws) {   // S3: ws draining
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws.destroy()
      this.ws = null
    } else {
      // equivalent to finished
      return
    }
  }

  error (err) {
    this.destroy()
    this.emit('finish', err)
    rimraf(this.path, () => {})
  }

}

class IPre2 extends EventEmitter {

  constructor(rs, filePath, size, sha256) {
    super()

    debug('constructing ipre2')

    this.rs = rs
    this.filePath = filePath
    this.size = size
    this.sha256 = sha256
    this.buffers = []
    this.ws = fs.createWriteStream(filePath)

    this.rs.on('data', data => {
      this.ws.write(data)
      this.buffers.push(data)
    })

    this.rs.on('end', () => this.ws.end())

    this.ws.on('finish', () => {
      let chunk = Buffer.concat(this.buffers)
      cryptoAsync.hash('SHA256', chunk, (err, hash) => {
        if (err) {
          this.emit('finish', err)
        } else if (hash.toString('hex') !== sha256) {
          this.emit('finish', new Error('sha256 mismatch'))
        } else {

          // console.log('IPre2 finish')

          this.digest = sha256
          this.emit('finish')
        }
      })
    })
  }
}

class IPre3 extends EventEmitter {

  constructor(rs, filePath, size, sha256) {
    super()

    debug('constructing ipre3')

    this.rs = rs
    this.filePath = filePath
    this.size = size
    this.sha256 = sha256
    this.buffers = []
    this.ws = fs.createWriteStream(filePath)

    this.rs.on('data', data => {
      this.ws.write(data)
      this.buffers.push(data)
    })

    this.rs.on('end', () => {
      this.ws.end()
      this.ws.on('finish', () => {
        this.ws = null
        if (this.digest) this.emit('finish')
      })

      let chunk = Buffer.concat(this.buffers)
      cryptoAsync.hash('SHA256', chunk, (err, hash) => {
        if (err || hash.toString('hex') !== sha256) {
          if (this.ws) {
            this.ws.removeAllListeners()
            this.ws.on('error', () => {})
            this.ws.destroy()
          }
          this.emit('finish', err || new Error('sha256 mismatch'))
        } else {
          this.digest = sha256
          if (!this.ws) this.emit('finish')
        }
      })
    })

  }
}

class IPre4 extends EventEmitter {

  constructor(rs, filePath, size, sha256) {
    super()

    debug('constructing ipre4')

    this.rs = rs
    this.filePath = filePath
    this.size = size
    this.sha256 = sha256

    const hash = crypto.createHash('sha256')
    const highWaterMark = os.totalmem() > 3 * 1024 * 1024 * 1024
      ? 256 * 1024 * 1024 
      : 64 * 1024 * 1024

    const ws = fs.createWriteStream(filePath, { highWaterMark })

    ws.on('open', fd => {

      this.fd = fd
      const sync = () => {
        if (this.finished) return
        fs.fsync(fd, () => {
          if (this.finished) return
          setImmediate(sync)
        })
      }

      sync()

    })

    ws.on('finish', () => {
      this.finished = true
      hash.end()
      this.digest = hash.read().toString('hex')
      fs.fsync(this.fd, () => this.emit('finish'))
    })

    rs.pipe(ws)
    rs.pipe(hash)
  }
}


/**
(2) ip-post

S   rs  ws  hash  digest  sha256
1   Y
2   Y   Y   (Y)   (Y)             // digest is generated before read stream end
3       Y         Y       Y       // ws is delibrartely delayed
4                 Y       Y
*/
class IPost extends EventEmitter {

  constructor(rs, filePath, size) {
    super()

    debug('constructing ipost')
    
    this.rs = rs
    this.path = filePath
    this.size = size
    this.sha256 = undefined

    this.fd = null
    this.bytesRead = 0
    this.bytesWritten = 0
    this.trailing = []
    this.ws = null 
    this.hash = null

    fs.open(this.path, 'w+', (err, fd) => {
      if (this.isFinished()) {
        if (!err) fs.close(fd, () => {})
        return
      }

      if (err) return this.error(err)

      // S1 -> S2
      this.ws = fs.createWriteStream(null, { fd })
      this.ws.on('error', err => this.error(err))
      this.ws.on('finish', () => {
        if (this.ws.bytesWritten !== this.size) {
          this.error(new Error('write stream bytesWritten mismatch'))
        } else {
          this.ws = null
          this.emit('finish')
        }
      })

      this.hash = crypto.createHash('sha256')

      this.rs.on('error', err => this.error(err))
      this.rs.on('data', data => {
        this.bytesRead += data.length
        if (this.bytesRead > this.size + 32) {
          let err = new Error('more data read than expected size')
          err.code = 'EOVERSIZE'
          this.error(err)
        } else {
          if (this.bytesWritten < this.size) {
            let data1

            if (this.bytesWritten + data.length <= this.size) {
              data1 = data
            } else { // >
              data1 = data.slice(0, this.size - this.bytesWritten)
              this.trailing.push(data.slice(this.size - this.bytesWritten))
            }

            this.hash.update(data1)
            this.ws.write(data1)
            this.bytesWritten += data1.length
          } else if (this.bytesWritten === this.size) {
            this.trailing.push(data) 
          } else {
            this.error(new Error('internal error, bytesWritten is larger than expected size'))
          }
        }
      })

      this.rs.on('end', () => {
        if (this.bytesRead < this.size + 32) {
          let err = new Error('less data read than expected size')
          err.code = 'EUNDERSIZE'
          this.error(err)
        } else {
          // assert internal state
          if (this.bytesWritten !== this.size) {
            return this.error(new Error('internal error, bytesWritten does not equal size'))
          }          

          // calc digest
          this.digest = this.hash.digest('hex')
          this.hash = null

          // buf size must be 32
          let sha256 = Buffer.concat(this.trailing).toString('hex')
          this.trailing = null

          if (sha256 !== this.digest) {
            let err = new Error('trailing hash mismatch')
            err.code = 'ESHA256MISMATCH'
            this.error(err)
          } else {
            // S2 -> S3, ws.end() is delibrartely delayed to avoid joining
            this.sha256 = sha256
            this.rs = null
            // this may trigger ws finish asynchronously
            this.ws.end()
          }
        }
      })
    })
  }

  readFinished () {
    return this.rs === null
  }

  isFinished () {
    return !this.rs && !this.ws
  }

  destroy () {
    if (this.rs && !this.ws) {
      this.rs.removeAllListeners()
      this.rs.on('error', () => {})
      this.rs = null
    } else if (this.rs && this.ws) {
      this.rs.removeAllListeners()
      this.rs.on('error', () => {})
      this.rs = null
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws = null
    } else if (!this.rs && this.ws) {
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws = null
    } else {
      // equivalent to isFinished()
      return
    }
  }

  error (err) {
    this.destroy()
    this.emit('finish', err)
    rimraf(this.path, () => {})
  }
}

/**

(3) cp-pre:

S   rs  ws  hs    digest  sha256
1   Y                     Y
2   Y   Y   Y             Y
3       Y   Y             Y
4           Y             Y
5                 Y       Y
*/
class CPre extends EventEmitter {

  constructor(rs, path, size, sha256) {
    super()

    this.rs = rs
    this.path = path
    this.size = size
    this.sha256 = sha256

    this.ws = null
    this.hash = null
    this.bytesRead = 0
    this.bytesWritten = 0

    fs.open(this.path, 'w+', (err, fd) => {
      if (this.isFinished()) {
        if (!err) fs.close(fd, () => {})
        return
      }

      if (err) return this.error(err)

      this.ws = fs.createWriteStream(null, { fd })
      this.ws.on('error', err => this.error(err))
      this.ws.on('finish', () => {
        if (this.ws.bytesWritten !== this.size) {
          this.error(new Error('write stream bytesWritten does not equal expected size'))
        } else {
          // S3 -> S4
          this.hash.on('message', message => {
            if (message !== this.sha256) {
              let err = new Error('sha256 mismatch')
              err.code = 'ESHA256MISMATCH'
              this.error(err)
            } else {
              // S4 -> S5
              this.digest = message
              this.destroy()
              this.emit('finish')
            }
          })
          this.ws = null
          this.hash.send('end')
        }
      })

      const opts = { stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd] }
      this.hash = child.spawn('node', ['-e', script], opts)
      this.hash.on('error', err => this.error(err))
      this.hash.on('exit', (code, signal) => this.error(new Error('unexpected exit')))

      this.rs.on('error', err => this.error(err))
      this.rs.on('data', data => {
        this.bytesRead += data.length
        if (this.bytesRead > this.size) {
          let err = new Error('more data read than expected size')
          err.code = 'EOVERSIZE'
          this.error(err)
        } else {
          this.ws.write(data, () => { 
            if (this.isFinished()) return
            this.hash.send(this.ws.bytesWritten)
          })
        }
      })
      this.rs.on('end', () => {
        if (this.bytesRead < this.size) {
          let err = new Error('less data read than expected size')
          err.code = 'EUNDERSIZE'
          this.error(err)
        } else {
          // S2 -> S3
          this.rs = null
          this.ws.end()
        }
      })
    })

  }

  isFinished () {
    return !this.rs && !this.ws && !this.ws && !this.hash
  }

  destroy () {
    if (this.isFinished()) return

    if (this.rs && !this.ws && !this.hash) {              // S1
      this.rs.removeAllListeners()
      this.rs.on('error', () => {})
      this.rs = null
    } else if (this.rs && this.ws && this.hash) {         // S2
      this.rs.removeAllListeners()
      this.rs.on('error', () => {})
      this.rs = null
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws.destroy()
      this.ws = null
      this.hash.removeAllListeners()
      this.hash.on('error', () => {})
      this.hash.kill()
      this.hash = null
    } else if (!this.rs && this.ws && this.hash) {        // S3
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws.destroy()
      this.ws = null
      this.hash.removeAllListeners()
      this.hash.on('error', () => {})
      this.hash.kill()
      this.hash = null
    } else if (!this.rs && !this.ws && this.hash) {       // S4
      this.hash.removeAllListeners() 
      this.hash.on('error', () => {})
      this.hash.kill()
      this.hash = null
    } else {
      console.log('invalid internal state', this)
      throw new Error('invalid internal state')
    }
  }

  error (err) {
    this.destroy()
    this.emit('finish', err)
    rimraf(this.path, () => {})
  }
}

/**
(3.1) cp-pre

*/
const preScript = `

const expectedSize = parseInt(process.env.EXPECTED_SIZE)
const expectedSHA256 = process.env.EXPECTED_SHA256 
const targetPath = process.env.TARGET_PATH
const socket = new require('net').Socket({ fd: 0 })
const ws = require('fs').createWriteStream(targetPath)
const hash = require('crypto').createHash('sha256')

ws.on('finish', () => {
  hash.end()
  let sha256 = hash.read().toString('hex')
  if (ws.bytesWritten < expectedSize) {         // undersize  1001
    process.exit(201)               
  } else if (ws.bytesWritten > expectedSize) {  // oversize   1002
    process.exit(202)
  } else if (sha256 !== expectedSHA256) {       // mismatch   1003
    process.exit(203)
  } else {
    process.exit(0)                             // success
  }
})

socket.pipe(ws)
socket.pipe(hash)
`

class CPre2 extends EventEmitter {

  constructor(rs, path, size, sha256) {
    super()
    this.rs = rs
    this.path = path
    this.size = size
    this.sha256 = sha256

    let opts = {
      // fd 0 is pipe (unix socket)
      stdio: ['pipe', 'inherit', 'inherit'],

      // pass arguments via env
      env: Object.assign({}, process.env, {
        EXPECTED_SIZE: size,
        EXPECTED_SHA256: sha256,
        TARGET_PATH: path
      })
    }

    let proc = child.spawn('node', ['-e', preScript], opts)
    proc.on('error', err => this.error(err))
    proc.on('exit', (code, signal) => {
      this.proc = null
      if (code === 0) {
        // for compatibility
        this.digest = sha256
        this.emit('finish')
      } else {
        let err
        if (!code) {
          err = new Error(`hash stream child process exits with signal ${signal}`)
          err.code = 'EKILLED'
        } else if (code === 201) {
          err = new Error(`less data read than expected size`)
          err.code = 'EUNDERSIZE'
        } else if (code === 202) {
          err = new Error(`more data read than expected size`)
          err.code = 'EOVERSIZE'
        } else if (code === 203) {
          err = new Error(`sha256 mismatch`)
          err.code = 'ESHA256MISMATCH'
        } else {
          err = new Error(`unexpected exit with code ${code}`)
        }
        this.error(err)
      }
    }) 

    rs.on('error', err => this.error(err))
    rs.pipe(proc.stdio[0])

    this.proc = proc
  }

  destroy () {
    if (this.proc) {
      this.proc.removeAllListeners()
      this.proc.on('error', () => {})
      this.proc.kill()
      this.proc = null
    }

    if (this.rs) {
      this.rs.unpipe()
      this.rs = null
    }
  }

  error (err) {
    this.destroy()
    this.emit('finish', err)
    rimraf(this.path, () => {})
  }
}


/**
(4) cp-post:
S   rs  ws  hs    digest  sha256
1   Y
2   Y   Y   Y
3       Y   Y             Y
4           Y             Y
5                 Y       Y
*/
class CPost extends EventEmitter {

  constructor(rs, filePath, size) {
    super()

    this.rs = rs
    this.path = filePath
    this.size = size

    this.ws = null
    this.hash = null
    this.trailing = [] 
    this.bytesRead = 0
    this.bytesWritten = 0
    
    fs.open(this.path, 'w+', (err, fd) => {
      if (this.isFinished()) {
        if (!err) fs.close(fd, () => {})
        return
      }

      if (err) return this.error(err)

      this.ws = fs.createWriteStream(null, { fd })
      this.ws.on('error', err => this.error(err))
      this.ws.on('finish', () => {
        if (this.ws.bytesWritten !== this.size) {
          this.error(new Error('write stream bytesWritten mismatch'))
        } else {
          // S3 -> S4
          this.hash.on('message', message => {
            if (message !== this.sha256) {
              let err = new Error('sha256 mismatch')
              err.code = 'ESHA256MISMATCH'
              this.error(err)
            } else {
              // S4 -> S5
              this.digest = message
              this.destroy()
              this.emit('finish')
            } 
          })
          this.hash.send('end')
          this.ws = null
        }
      })

      const opts = { stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd] } 
      this.hash = child.spawn('node', ['-e', script], opts)
      this.hash.on('error', err => this.error(err))
      this.hash.on('exit', (code, signal) => {
        console.log(code, this.rs, this.ws, !!this.hash)
        this.error(new Error('unexpected exit'))
      })

      this.rs.on('error', err => this.error(err))
      this.rs.on('data', data => {
        this.bytesRead += data.length
        if (this.bytesRead > this.size + 32) {
          let err = new Error('more data read than expected size')
          err.code = 'EOVERSIZE'
          this.error(err)
        } else {
          if (this.bytesWritten < this.size) {
            let data1
            if (this.bytesWritten + data.length <= this.size) {
              data1 = data
            } else {
              data1 = data.slice(0, this.size - this.bytesWritten)
              this.trailing.push(data.slice(this.size - this.bytesWritten))
            }

            this.ws.write(data1, () => { 
              if (this.isFinished()) return
              this.hash.send(this.ws.bytesWritten)
            })
            this.bytesWritten += data1.length
          } else if (this.bytesWritten === this.size) {
            this.trailing.push(data)
          } else {
            this.error(new Error('internal error, bytesWriten is larger than expected size'))
          }
        }
      })
      this.rs.on('end', () => {
        if (this.bytesRead < this.size + 32) {
          let err = new Error('less data read than expected size')
          err.code = 'EUNDERSIZE'
          this.error(err)
        } else {
          // assert internal state
          if (this.bytesWritten !== this.size) {
            return this.error(new Error('internal error, bytesWritten does not equal size'))
          }

          // S2 -> S3
          this.sha256 = Buffer.concat(this.trailing).toString('hex')
          this.trailing = null
          this.rs = null
          this.ws.end()
        }
      }) 
    })
  }

  readFinished () {
    return this.rs === null
  }

  isFinished () {
    return !this.rs && !this.ws && !this.hash
  }

  destroy () {
    if (this.isFinished()) return

    if (this.rs && !this.ws && !this.hash) {
      this.rs.removeAllListeners() 
      this.rs.on('error', () => {})
      this.rs = null
    } else if (this.rs && this.ws && this.hash) {
      this.rs.removeAllListeners()
      this.rs.on('error', () => {})
      this.rs = null
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws.destroy()
      this.ws = null
      this.hash.removeAllListeners()
      this.hash.on('error', () => {})
      this.hash.kill()
      this.hash = null
    } else if (!this.rs && this.ws && this.hash) {
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws.destroy()
      this.ws = null
      this.hash.removeAllListeners()
      this.hash.on('error', () => {})
      this.hash.kill()
      this.hash = null
    } else if (!this.rs && !this.ws && this.hash) {
      this.hash.removeAllListeners()
      this.hash.on('error', () => {})
      this.hash.kill()
      this.hash = null
    } else {
      console.log('invalid internal state', this)
      throw new Error('invalid internal state')
    }
  }

  error (err) {
    this.destroy() 
    this.emit('finish', err)
    rimraf(this.path, () => {})
  }
}

module.exports = {

  thresh: 16 * 1024 * 1024,

/**
  createStream: function (rs, filePath, size, sha256, aggressive) {
    if (sha256) {

      // return new IPre4(rs, filePath, size, sha256)
      if (size > this.thresh) {
        debug('create child-process pre')
        if (!!aggressive) {
          return new CPre(rs, filePath, size, sha256)
        } else {
          return new CPre2(rs, filePath, size, sha256)
        }
      } else {
        debug('create in-process pre')
        return new IPre2(rs, filePath, size, sha256)
      }
    } else {
      if (size > this.thresh) {
        debug('create child-process post')
        return new CPost(rs, filePath, size)
      } else {
        debug('create in-process post')
        return new IPost(rs, filePath, size)
      }
    }
  },
**/

  createStream: function (rs, filePath, size, sha256) {
    return sha256 
      ? new IPre2(rs, filePath, size, sha256)
      : new IPost(rs, filePath, size)
  }, 

  IPre, 
  IPost,
  CPre: CPre2,
  CPost 
}
