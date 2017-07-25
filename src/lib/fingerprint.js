const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const crypto = require('crypto')

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

  console.log('-> ', message)

  let hash = crypto.createHash('sha256')
  hash.on('error', () => process.exit(1))
  hash.on('readable', () => {
    process.send(hash.read().toString('hex'))
    process.exit()
  })
  let rs = fs.createReadStream(message.filePath, { start: message.start, end: message.end })
  rs.on('error', () => process.exit(1))
  rs.pipe(hash)
})

`

fs.writeFileSync(childModulePath, childSource)

const Mixin = base => class extends base {

  constructor(...args) {
    super(...args)
    this._untils = []
  }

  async untilAsync (predicate, ignore) {
    if (predicate()) return
    return new Promise((resolve, reject) => this._untils.push({ 
      predicate, 
      resolve, 
      reject: ignore ? null : reject
    }))
  }

  _until () {
    this._untils = this._untils.reduce((arr, x) => (this.error && x.reject) 
      ? K(arr)(x.reject())
      : x.predicate() 
        ? K(arr)(x.resolve()) 
        : [...arr, x], [])
  }

  observe (name, value) {
    let _name = '_' + name
    this[_name] = value
    Object.defineProperty(this, name, {
      get: function () {
        return this[_name]
      },
      set: function (x) { 
        if (this[_name]) return // TODO
        console.log('observe set', name, x)
        this[_name] = x
        process.nextTick(() => this._until())
      }
    })
  }
}

// class HashWorker extends Mixin(

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
  : combineHash([
      crypto.createHash('sha256').update(bufs[0]).update(bufs[1]).digest(), 
      ...bufs.slice(2)
    ])

const fingerprintAsync = async filePath => {

  let stat1 = await fs.lstatAsync(filePath)
  if (!stat1.isFile()) throw new Error('not a file')
  if (stat1.size === 0) return ZERO_HASH

  let segments = chop(stat1.size) 
  let buffers = await Promise.map(segments, async segment => new Promise((resolve, reject) => {

    let error, digest, worker = child.fork(childModulePath)
    worker.on('message', message => digest = message)
    worker.on('error', err => {
      if (error) return
      error = err
      worker.kill()
      reject(err)
    })
    worker.on('exit', (code, signal) => {
      if (code || signal || !digest) return reject(new Error('error exit code or killed'))
      resolve(Buffer.from(digest, 'hex')) 
    })
    worker.send({ filePath, start: segment.start, end: segment.end })
  }), { concurrency: 4 })

  let stat2 = await fs.lstatAsync(filePath)
  if (stat2.mtime.getTime() !== stat1.mtime.getTime()) throw new Error('timestamp mismatch')

  return combineHash(buffers).toString('hex')
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




