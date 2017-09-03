const mkdirp = require('mkdirp')
const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const broadcast = require('../common/broadcast')
const { fileMagicAsync } = require('../lib/xstat')
const identify = require('../lib/identify')

class BlobStore {

  constructor(ctx) {
    this.ctx = ctx
    this.dir = path.join(this.ctx.fruitmixPath, 'blobs')

    mkdirp(this.dir, err => {
      if (err) {
        console.log(err)
        broadcast.emit('BlobsInitDone', err)
        return
      }

      broadcast.emit('BlobsInitDone')
    })
  }

  async reportAsync(hashArr) {
    // filter out medias
    let magics = await Promise.map(hashArr, async item => {
      return await fileMagicAsync(path.join(this.dir, item))
    })
    let medias = hashArr.filter((item, index, array) => {
      if (magics[index] === 'JPEG') return true
    })

    // register media in MediaMap
    medias.forEach(m => {
      let fpath = path.join(this.dir, m)
      let metadata = identify(fpath, m).run()
      this.ctx.reportMedia(m, metadata)
    })
  }

  async loadAsync() {
    let entries = await fs.readdirAsync(this.dir)
    await this.reportAsync(entries)
  }

  // store a list of files
  // src is an array of tmp filepath, file name is the sha256 of itself
  store(src, callback) {
    let srcStr = src.join(' ')
    let dst = this.dir

    child.exec(`chmod 444 ${srcStr}`, (err, stdout, stderr) => {
      if (err) return callback(err)
      if (stderr) return callback(stderr)

      child.exec(`mv ${srcStr} -t ${dst}`, (err, stdout, stderr) => {
        if (err) return callback(err)
        if (stderr) return callback(stderr)
        let hashArr = src.map(s => path.basename(s))
        this.reportAsync(hashArr)
          .then(() => callback(stdout))
          .catch(e => callback(e))
      })
    })
  }

  async storeAsync(src) {
    return Promise.promisify(this.store).bind(this)(src)
  }

  retrieve(hash) {
    return path.join(this.dir, hash)
  }
}

module.exports = BlobStore

