const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const broadcast = require('../common/broadcast')
const { fileMagic6 } = require('../lib/xstat')
const identify = require('../lib/identify')
const mkdirp = require('mkdirp')
const EventEmitter = require('events').EventEmitter 
const debug = require('debug')('boxes')

class BlobCTX extends EventEmitter {
  /**
   * @param {Object} ctx - context 
   */
  constructor(ctx) {
    super()
    this.ctx = ctx
    this.dir = path.join(this.ctx.fruitmixPath, 'blobs')
    mkdirp.sync(this.dir)
    this.pendingBlobs = new Set()
    this.readingBlobs = new Set()
    this.failedBlobs = new Set()
    this.medias = new Map()
  }

  blobEnterPending(blobUUID) {
    debug(`blob ${blobUUID} enter pending`)
    this.pendingBlobs.add(blobUUID)
    this.reqSchedBlobRead()
  }

  blobExitPending(blobUUID) {
    debug(`blob ${blobUUID} exit pending`)
    this.pendingBlobs.delete(blobUUID)
    this.reqSchedBlobRead()
  }

  blobEnterReading(blobUUID) {
    debug(`blob ${blobUUID} enter reading`)
    this.readingBlobs.add(blobUUID)
    this.reqSchedBlobRead()
  }

  blobExitReading(blobUUID) {
    debug(`blob ${blobUUID} exit reading`)
    this.readingBlobs.delete(blobUUID)
    this.reqSchedBlobRead()
  }

  blobEnterFailed(blobUUID) {
    debug(`blob ${blobUUID} enter failed`)
    this.failedBlobs.add(blobUUID)
    this.reqSchedBlobRead()
  }

  reqSchedBlobRead() {
    if (this.blobReadScheduled) return
    this.blobReadScheduled = true
    process.nextTick(() => this.scheduleBlobRead())
  }

  blobReadSettled() {
    return this.pendingBlobs.size === 0 &&
      this.readingBlobs.size === 0
  }

  scheduleBlobRead() {
    this.blobReadScheduled = false
    if (this.blobReadSettled()) {
      this.emit('BlobReadDone')
      debug('blob read finished')
      return
    }

    let finalized = (blobUUID, err) => {
      this.blobExitReading(blobUUID)
      if (err) {
        this.blobEnterFailed(blobUUID)
        return console.log(err)
      }
    }

    while (this.pendingBlobs.size > 0 && this.readingBlobs.size < 6) {
      let blobUUID = this.pendingBlobs[Symbol.iterator]().next().value
      this.blobExitPending(blobUUID)
      let blobPath = path.join(this.dir, blobUUID)
      this.blobEnterReading(blobUUID)
      fs.lstat(blobPath, (err, stat) => {
        if (err) return finalized(blobUUID, err)
        fileMagic6(blobPath, (err, magic) => {
          if (err) return finalized(blobUUID, err)
          if (magic === 'JPEG') {
            let worker = identify(blobPath, blobUUID)
            worker.on('finish', data => {
              this.medias.set(blobUUID, data)
              this.ctx.reportMedia(blobUUID, data) // TODO: 
              return finalized(blobUUID)
            })
            worker.on('error', err => finalized(blobUUID, err))
            worker.run()
          } else return finalized(blobUUID)
        })
      })
    }
  }
}

/**
 * @class BlobStore
 */
class BlobStore extends BlobCTX{


  loadBlobs(callback) {
    debug('blob start load')
    fs.readdir(this.dir, (err, entries) => {
      if(err) return callback(err)
      entries.forEach(e => this.blobEnterPending(e))
      this.emit('BlobLoadFinished')
      callback()
    })
  }
  // register medias in MediaMap
  /**
   * register medias in MediaMap
   * @param {array} hashArr - an array of media hash to be reported
   * @param {function} callback
   */
  report(hashArr, callback) {
    if (hashArr.length) {
      let error = false
      for (let i = 0; i < hashArr.length; i++) {
        fileMagic6(path.join(this.dir, hashArr[i]), (err, magic) => {
          if (error) return
          if (err) {
            error = true
            return callback(err)
          }
          if (magic === 'JPEG') {
            let fpath = path.join(this.dir, hashArr[i])
            let worker = identify(fpath, hashArr[i])
            worker.run()
            worker.on('finish', data => {
              this.ctx.reportMedia(hashArr[i], data)
              if (++i === hashArr.length) return callback()
            })
            worker.on('error', err => callback(err))
          } else return callback()
        })
      }
    } else return callback()
  }

  /**
   * async edition of report
   * @param {*} hashArr - an array of media hash to be reported
   */
  async reportAsync(hashArr) {
    return Promise.promisify(this.report).bind(this)(hashArr)
  }

  /**
   * load all medias in blobs, register them in MediaMap
   */
  async loadAsync() {
    let entries = await fs.readdirAsync(this.dir)
    await this.reportAsync(entries)
  }

  // store a list of files
  // src is an array of tmp filepath, file name is the sha256 of itself
  /**
   * 
   * @param {array} src - an array of filepaths to be stored into blobs
   * @param {function} callback 
   */
  store(src, callback) {
    if(!src || !src.length) return process.nextTick(() => callback(null))
    let srcStr = src.join(' ')
    let dst = this.dir
    debug('start store blob')
    // move files into blobs
    child.exec(`mv ${srcStr} -t ${dst}`, (err, stdout, stderr) => {
      if (err) return callback(err)
      if (stderr) return callback(stderr)
      let hashArr = src.map(s => path.basename(s))
      debug(hashArr)
      hashArr.forEach(x => this.blobEnterPending(x))
      let files = hashArr.map(i => path.join(dst, i)).join(' ')
      // modify permissions to read only
      child.exec(`chmod 444 ${files}`, (err, stdout, stderr) => {
        if (err) return callback(err)
        if (stderr) return callback(stderr)
        callback(null, stdout)
      })
    })
  }

  /**
   * async edition of store
   * @param {array} src - an array of filepaths to be stored into blobs
   */
  async storeAsync(src) {
    return new Promise((resolve, reject) => {
      this.store(src, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  /**
   * get a filepath by given file hash
   * @param {string} hash - hash of file to be retrieved
   * @param {string} path
   */
  retrieve(hash) {
    let bpath = path.join(this.dir, hash)
    if(fs.existsSync(bpath)) return bpath
    return false
  }
}

module.exports = BlobStore

