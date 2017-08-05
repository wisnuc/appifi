const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')

const modulePath = path.join('/tmp', '47562b6b-a082-4329-8002-8c2ffe923a3a')

const moduleSource = `

const fs = require('fs')
const crypto = require('crypto')
const SIZE1G = 1024 * 1024 * 1024

process.on('message', message => {
  let { src, dst } = message

  // init to empty buffer
  let fingerprint
  let total = 0
  let count = 0

  let hash = crypto.createHash('sha256')
  let rs = fs.createReadStream(src)
  let ws = fs.createWriteStream(dst)
  let update = () => fingerprint = fingerprint
    ? crypto.createHash('sha256').update(fingerprint).update(hash.digest()).digest()
    : hash.digest() 

  rs.on('data', _data => {
    ws.write(_data)    
    total += _data.length

    let data = _data
    while (count + data.length >= SIZE1G) {
      // slice head, update hash and fingerprint
      let delta = SIZE1G - count      
      hash.update(data.slice(0, delta))
      update()

      // renew hash, reset count, slice data
      hash = crypto.createHash('sha256')
      count = 0
      data = data.slice(delta)
    }

    count += data.length
    hash.update(data)

/**
    if (count < SIZE1G) {
      hash.update(data)
    } else {
      count -= SIZE1G
      hash.update(data.slice(0, data.length - count))
      fingerprint = combine(fingerprint, hash.digest())
      hash = crypto.createHash('sha256').update(data.slice(data.length - count))
    }
**/
  })
  
  rs.on('error', err => process.exit(1))
  rs.on('end', () => {
    if (total === 0 || count !== 0) update()
    ws.end()
  })

  ws.on('error', err => process.exit(1))
  ws.on('close', () => {
    process.send(fingerprint.toString('hex'))
    process.exit(0)
  })
})
`

fs.writeFileSync(modulePath, moduleSource)

module.exports = (src, dst, callback) => {
  let finished = false
  let fingerprint

  let worker = child.fork(modulePath)
  worker.send({ src, dst })
  worker.on('message', message => !finished && (fingerprint = message))
  worker.on('error', err => {
    if (finished) return
    finished = true
    callback(err)
  })
  worker.on('exit', (code, signal) => {
    if (finished) return
    finished = true
    if (code || signal) {
      callback(new Error(`error exit code or signal`))
    } else {
      callback(null, fingerprint)
    }
  })

  return () => {
    if (finished) return
    finished = true
    worker.kill()
  }
}


