const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const broadcast = require('../common/broadcast')
const { fileMagic2 } = require('../lib/xstat')
const identify = require('../lib/identify')

/**
 * blobStore
 */
class BlobStore {

  /**
   * 
   * @param {Object} ctx - context 
   */
  constructor(ctx) {
    this.ctx = ctx
    this.dir = path.join(this.ctx.fruitmixPath, 'blobs')

    // if dir path not exist, create it
    if (!fs.existsSync(this.dir)) {
      try{
        fs.mkdirSync(this.dir)
        broadcast.emit('BlobsInitDone')
      }
      catch(e) {
        broadcast.emit('BlobsInitDone', e)
      }
    }
  }

  // register medias in MediaMap
  /**
   * register medias in MediaMap
   * @param {array} hashArr - an array of media hash to be reported
   * @param {function} callback
   */
  report(hashArr, callback) {
    if (hashArr.length) {
      for(let i = 0; i < hashArr.length; i++) {
        fileMagic2(path.join(this.dir, hashArr[i]), (err, magic) => {
          if (err) return callback(err)
          if (magic === 'JPEG') {
            let fpath = path.join(this.dir, hashArr[i])
            let worker = identify(fpath, hashArr[i])
            worker.run()
            worker.on('finish', data => {
              this.ctx.reportMedia(hashArr[i], data)
              if (++i === hashArr.length) return callback()
            })
            worker.on('error', err => callback(err))
          }
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
    let srcStr = src.join(' ')
    let dst = this.dir

    // move files into blobs
    child.exec(`mv ${srcStr} -t ${dst}`, (err, stdout, stderr) => {
      if (err) return callback(err)
      if (stderr) return callback(stderr)
      let hashArr = src.map(s => path.basename(s))
      this.reportAsync(hashArr)
        .then(() => {
          let files = hashArr.map(i => path.join(dst, i)).join(' ')
          // modify permissions to read only
          child.exec(`chmod 444 ${files}`, (err, stdout, stderr) => {
            if (err) return callback(err)
            if (stderr) return callback(stderr)
            callback(null, stdout)
          })
        })
        .catch(e => callback(e))
    })
  }

  /**
   * async edition of store
   * @param {array} src - an array of filepaths to be stored into blobs
   */
  async storeAsync(src) {
    return Promise.promisify(this.store).bind(this)(src)
  }

  /**
   * get a filepath by given file hash
   * @param {string} hash - hash of file to be retrieved
   * @param {string} path
   */
  retrieve(hash) {
    return path.join(this.dir, hash)
  }
}

module.exports = BlobStore

