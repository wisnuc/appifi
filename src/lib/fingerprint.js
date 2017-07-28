const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const EventEmitter = require('events')
const crypto = require('crypto')

const debug = require('debug')('fingerprint')

// constant
const SIZE_1G = 1024 * 1024 * 1024
const ZERO_HASH = crypto.createHash('sha256').digest('hex') 

// path for child module
const childModulePath = path.join('/', 'tmp', '6e6beb12-0552-4e5d-9696-db3fcd8e32d6')

// Here doc for child source
const childSource = `

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

process.on('message', message => {

  let hash = crypto.createHash('sha256')
  hash.on('error', () => process.exit(1))
  hash.on('readable', () => {
    process.send(hash.read().toString('hex'))
    process.exit(0)
  })

  let rs = fs.createReadStream(message.filePath, { start: message.start, end: message.end })
  rs.on('error', () => process.exit(1))
  rs.pipe(hash)
})

`

fs.writeFileSync(childModulePath, childSource)

const chop = number => {
  let arr = []
  for (; number > SIZE_1G; number -= SIZE_1G) {
    let start = arr.length === 0 ? 0 : arr[arr.length - 1].end
    arr.push({ start, end: start + SIZE_1G })
  }

  let start = arr.length === 0 ? 0 : arr[arr.length - 1].end
  arr.push({ start, end: start + number})
  return arr
}

const combineHash = bufs => bufs.length === 1 
  ? bufs[0] 
  : combineHash([crypto.createHash('sha256').update(bufs[0]).update(bufs[1]).digest(), ...bufs.slice(2)])


const fingerprintAsync = async filePath => {

  let workers = []

  try {
    let stat1 = await fs.lstatAsync(filePath)
    if (!stat1.isFile()) throw new Error('not a file')
    if (stat1.size === 0) return ZERO_HASH

    let segments = chop(stat1.size) 

    // bluebird promise.map has concurrency option
    let buffers = await Promise.map(segments, async segment => new Promise((resolve, reject) => {

      let error
      const setError = err => {
        if (error) return
        error = err
        reject(err)
      }

      let digest
      let worker = child.fork(childModulePath)
      worker.on('message', message => digest = message)
      worker.on('error', err => setError(err))
      worker.on('exit', (code, signal) => {
        if (error) return
        if (code || signal || !digest) {
          setError(new Error('error exit code or being killed'))
        } else {
          resolve(Buffer.from(digest, 'hex')) 
        }
      })
      worker.send({ filePath, start: segment.start, end: segment.end })
      workers.push(worker)

    }), { concurrency: 4 })

    let stat2 = await fs.lstatAsync(filePath)
    if (stat2.mtime.getTime() !== stat1.mtime.getTime()) throw new Error('timestamp mismatch')

    return combineHash(buffers).toString('hex')

  } finally {
    workers.forEach(worker => worker.kill())
  }
}

const fingerprint = (filePath, callback) => 
  fingerprintAsync(filePath)
    .then(digest => callback(null, digest))
    .catch(e => callback(e))

module.exports = fingerprint

if (process.argv.includes('--standalone')) {
  fingerprint('testdata/ubuntu.iso', (err, digest) => {
    console.log(err || digest)
  })
}




