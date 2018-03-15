const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const os = require('os')

const broadcast = require('../common/broadcast')
const { fileMagic6 } = require('../lib/xstat')
const identify = require('../lib/identify')
const mkdirp = require('mkdirp')
const EventEmitter = require('events').EventEmitter 
const debug = require('debug')('boxes:boxes')
const exiftool = require('../lib/exiftool2')
const Magic = require('../lib/magic')

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
    this.sizeMap = new Map()
    this.needRetry = true // can retry failedBlobs
  }

  blobEnterPending(blobUUID) {
    debug(`blob ${blobUUID} enter pending`)
    this.pendingBlobs.add(blobUUID)
    this.needRetry = true // refrush 
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

  // schedule blobs to read meta if blob has magic
  scheduleBlobRead() {
    this.blobReadScheduled = false
    if (this.blobReadSettled()) {
      this.emit('BlobReadDone')
      if(this.needRetry && this.failedBlobs.size) { // retry failed blob
        this.failedBlobs.forEach(b => this.blobEnterPending(b))
        this.failedBlobs.clear()
        this.needRetry = false
      }
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

    //FIXME: no need
    let core = os.cpus().length
    let load = os.loadavg()[0]
    const shouldSpawn = () => {
      if (this.pendingBlobs.size === 0) return false
      if (this.readingBlobs.size === 0) return true
      return (load + this.readingBlobs.size / 2 - 0.5) < core
    }


    while (shouldSpawn()) {
      let blobUUID = this.pendingBlobs[Symbol.iterator]().next().value
      this.blobExitPending(blobUUID)
      let blobPath = path.join(this.dir, blobUUID)
      this.blobEnterReading(blobUUID)
      fs.lstat(blobPath, (err, stat) => {
        if (err) return finalized(blobUUID, err)
        this.sizeMap.set(blobUUID, stat.size)
        let metadata = this.ctx.mediaMap.getMetadata(blobUUID)
        if (metadata) {
          this.medias.set(blobUUID, metadata)
          // this.ctx.reportMedia(blobUUID, metadata) // TODO: 
          return finalized(blobUUID)
        }

        if(this.medias.has(blobUUID)) return finalized(blobUUID)

        fileMagic6(blobPath, (err, magic) => {
          if (err) return finalized(blobUUID, err)
          if (Magic.isMedia(magic)) {
            exiftool(blobPath, magic, (err, data) => {
              if(err) return finalized(blobUUID, err)
              this.medias.set(blobUUID, data)
              // this.ctx.reportMedia(blobUUID, data) // TODO: 
              return finalized(blobUUID)
            })
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
/*
    let counter = src.length
    let error
    let finishHandle = () => {
      if(--counter) return
      let hashArr = src.map(s => path.basename(s))
      hashArr.forEach(x => this.blobEnterPending(x))
      let files = hashArr.map(i => path.join(dst, i)).join(' ')
      callback(null)
    }
    let errorHandle = (err) => {
      if (error) return
      error = err
      debug(err)
      return callback(err)
    }
    
    src.forEach(filepath => {
      let sha256 = path.basename(filepath)
      fs.rename(filepath, path.join(dst,sha256), err => {
        if(err) return errorHandle(err)
        finishHandle()
      })
    })
*/
    // move files into blobs
    child.exec(`mv ${srcStr} -t ${dst}`, (err, stdout, stderr) => {
      if (err) return callback(err)
      if (stderr) return callback(stderr)
      let hashArr = src.map(s => path.basename(s))
      hashArr.forEach(x => this.blobEnterPending(x))
      let files = hashArr.map(i => path.join(dst, i)).join(' ')
      // modify permissions to read only
      // child.exec(`chmod 444 ${files}`, (err, stdout, stderr) => {
      //   if (err) return callback(err)
      //   if (stderr) return callback(stderr)
      callback(null, stdout)
      // })
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

  /**
   * get metadatas for blobUUIDs items
   * @param {Array} blobUUIDs - blob uuids array
   * @param {Function} callback - callback metas map if blobs has , 
   */
  async readBlobsAsync(blobUUIDs) {
    let metaMap = new Map()
    // create promise array
    let ps = blobUUIDs.map(blobUUID => 
      new Promise((resolve, reject) => {
        this.readBlob(blobUUID, (err, data) => {
          if(err) return reject(err)
          if(data) metaMap.set(blobUUID, data)
          resolve()
        })
      })
    )

    await Promise.all(ps)
    return metaMap
  }

  readBlob(blobUUID, callback) {
    let blobPath = path.join(this.dir, blobUUID)
    fs.lstat(blobPath, (err, stat) => {
      if (err) return callback(err)
      this.sizeMap.set(blobUUID, stat.size)
      let metadata = this.ctx.mediaMap.getMetadata(blobUUID)
      if (metadata) {
        this.medias.set(blobUUID, metadata)
        return callback(null, Object.assign({}, { metadata, size: stat.size }))
      }

      metadata = this.medias.get(blobUUID)
      if(metadata) return callback(null, Object.assign({}, { metadata, size: stat.size }))
      
      fileMagic6(blobPath, (err, magic) => {
        if (err) return callback(err)
        if (Magic.isMedia(magic)) {
          exiftool(blobPath, magic, (err, data) => {
            if(err) return callback(err)

            this.medias.set(blobUUID, data)
            return callback(null, Object.assign({}, { metadata: data, size: stat.size }))
          })
        } else return callback(null)
      })
    })
  }
}

module.exports = BlobStore

