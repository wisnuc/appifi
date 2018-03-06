const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const Stringify = require('canonical-json')
const Promise = require('bluebird')
const child = require('child_process')
const broadcast = require('../common/broadcast')

class DocStore {

  // the factory must assure the tmp folder exists !
  constructor(froot) {
    this.dir = path.join(froot, 'objects')
    mkdirp.sync(this.dir)
    broadcast.emit('DocStoreInitDone')
  }

  store(src, callback) {
    let srcStr = src.join(' ')
    let dst = this.dir

    child.exec(`mv ${srcStr} -t ${dst}`, (err, stdout, stderr) => {
      if (err) return callback(err)
      if (stderr) return callback(stderr)
      return callback(null, stdout)
    })
  }

  async storeAsync(pathArr) {
    return Promise.promisify(this.store).bind(this)(pathArr)
  }

  retrieve(hash, callback) {
    let srcpath = path.join(this.dir, hash)
    fs.readFile(srcpath, (err, data) => {
      if (err) return callback(err)
      try {
        callback(null, JSON.parse(data.toString()))
      }
      catch (e) {
        callback(e)
      }
    })
  }

  async retrieveAsync(hash) {
    return Promise.promisify(this.retrieve).bind(this)(hash)
  }

}

module.exports = DocStore