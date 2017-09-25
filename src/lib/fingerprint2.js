const path = require('path')
const fs = require('fs')
const child = require('child_process')
const crypto = require('crypto')

const script = `
const fs = require('fs')
const crypto = require('crypto')

const hashes = []
let hash = crypto.createHash('sha256')
let count = 0

const opts = { fd: 4, highWaterMark: 4 * 1024 * 1024 }
const ws = fs.createReadStream(null, opts) 
ws.on('error', () => { 
  ws.removeAllListeners()
  ws.on('error', () => {})
  process.exit(999)
})

ws.on('data', data => {
  if (data.length + count > (1024 * 1024 * 1024)) {
    hash.update(data.slice(0, (1024 * 1024 * 1024 - count)))
    hashes.push(hash.digest())
    hash = crypto.createHash('sha256')
    hash.update(data.slice((1024 * 1024 * 1024 - count)))
    count = data.length + count - 1024 * 1024 * 1024
  } else if (data.length + count === (1024 * 1024 * 1024)) {
    hash.update(data)
    hashes.push(hash.digest())
    hash = crypto.createHash('sha256')
    count = 0
  } else {
    hash.update(data) 
    count += data.length
  }
})

ws.on('end', () => {
  if (count) hashes.push(hash.digest())

  let fingerprint
  if (hashes.length === 0) {
    fingerprint = crypto.createHash('sha256').digest()
  } else {
    fingerprint = hashes.shift() 
    while (hashes.length)
      fingerprint = crypto
        .createHash('sha256')
        .update(Buffer.concat([fingerprint, hashes.shift()]))
        .digest()
  }

  process.send(fingerprint.toString('hex'), () => process.exit())
})

`
const EMPTY_SHA256_HEX = crypto.createHash('sha256').digest('hex')

const fingerprint = (fpath, callback) => {

  let hash
  let destroyed = false
  const destroy = () => {
    if (destroyed) return

    if (hash) {
      hash.removeAllListeners()
      hash.on('error', () => {})
      hash.kill()
      hash = null
    }

    destroyed = true
  }

  fs.open(fpath, 'r', (err, fd) => {
    if (destroyed) return fs.close(fd, () => {})
    if (err) return callback(err)

    const opts = { stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd]  }
    hash = child.spawn('node', ['-e', script], opts)
    hash.on('error', err => (destroy(), callback(err)))
    hash.on('message', message => (destroy(), callback(null, message)))
    hash.on('exit', (code, signal) => {
      let err = new Error(`unexpected exit with code ${code}, signal ${signal}`)
      destroy()
      callback(err)
    })
  }) 

  return destroy
}

module.exports = fingerprint
