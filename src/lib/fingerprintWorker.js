const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const EventEmitter = require('events')
const crypto = require('crypto')

const threadify = require('./threadify')

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

//
// !!! fs.read start and end are both INCLUSIVE !!!
//
const chop = number => {

  let arr = []
  while (number > SIZE_1G) {
    arr.push({ 
      start: arr.length * SIZE_1G, 
      end: (arr.length + 1) * SIZE_1G - 1 
    })
    number -= SIZE_1G
  }

  if (number !== 0) {
    arr.push({
      start: arr.length * SIZE_1G,
      end: arr.length * SIZE_1G + number - 1
    })
  }

  return arr
}

// !!! accept only buffer
const combineHash = bufs => bufs.length === 1 
  ? bufs[0] 
  : combineHash([crypto.createHash('sha256').update(bufs[0]).update(bufs[1]).digest(), ...bufs.slice(2)])

class FingerprintWorker extends threadify(EventEmitter) {

  constructor(filePath) {
    super()

    this.define('workers', [])
    this.defineSetOnce('data', () => this.emit('data', this.data))
    this.defineSetOnce('error', () => {
      this.workers.forEach(worker => worker.kill())
      this.emit('error', this.error)
    })

    this.run(filePath)
      .then(data => data && (this.data = data))
      .catch(e => this.error = e)

    this.untilAnyway(() => this.workers.length === 0 && (this.error || this.data))
      .then(() => this.emit('finish'))
  }

  async run (filePath) {
    let stat1 = await fs.lstatAsync(filePath)
    if (!stat1.isFile()) throw new Error('not a file')
    if (stat1.size === 0) {

      return {
        fingerprint: crypto.createHash('sha256').digest('hex'),
        timestamp: stat1.mtime.getTime()
      }
    }

    let segments = chop(stat1.size)

    // for debug
    this.segments = segments

    let buffers = await Promise.map(segments, async segment => new Promise((resolve, reject) => {
      let finished = false 
      let worker = child.fork(childModulePath)
      worker.on('message', message => {
        if (finished) return
        finished = true
        resolve(message)
      })
      worker.on('error', err => {
        if (finished) return
        finished = true
        reject(err)
      }) 
      worker.on('exit', (code, signal) => {
        // remove out of worker queue          
        let index = this.workers.findIndex(w => w === worker)
        this.workers = [...this.workers.slice(0, index), ...this.workers.slice(index + 1)]

        if (finished) return
        finished = true

        if (code || signal) {
          reject(new Error(`error exit, code ${code}, signal ${signal}`))
        } else {
          reject(new Error('unexpected, exit 0 but unresolved'))
        }
      })

      // start
      worker.send({ filePath, start: segment.start, end: segment.end })
      // enqueue 
      this.workers.push(worker) 
    }, { concurrentcy: 3 }).bind(this))

    // for debug
    this.digests = buffers.map(buf => buf.toString('hex'))

    let stat2 = await fs.lstatAsync(filePath)
    if (stat2.mtime.getTime() !== stat1.mtime.getTime()) throw new Error('timestamp mismatch')

    return {
      fingerprint: combineHash(buffers.map(str => Buffer.from(str, 'hex'))).toString('hex'),
      timestamp: stat1.mtime.getTime()
    }
  }

  abort() {
    this.error = new Error('aborted')
  }
}

module.exports = filePath => new FingerprintWorker(filePath) 
