const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const Stringify = require('canonical-json')
const Promise = require('bluebird')

const writeFileToDisk = (fpath, data, callback) => {

  let error, os = fs.createWriteStream(fpath)

  os.on('error', err => {
    error = err
    callback(err)
  })

  os.on('close', () => {
    if (!error) callback(null)
  })

  os.write(data)
  os.end()
}

// import paths from './paths'

class DocStore {

  // the factory must assure the tmp folder exists !
  constructor(docdir, tmpdir) {
    this.docdir = docdir
    this.tmpdir = tmpdir
  }

  store(object, callback) {

    let text, hash, digest, dirpath, filepath, tmppath

    // text = JSON.stringify(object)
    try {
      text = Stringify(object)
    }
    catch (e) {
      return callback(e)
    }

    hash = crypto.createHash('sha256')
    hash.update(text)
    digest = hash.digest().toString('hex')

    // src is in tmp folder
    filepath = path.join(this.docdir, digest)
    tmppath = path.join(this.tmpdir, digest)

    mkdirp(this.docdir, err => { // create head dir
      if (err) return callback(err)
      writeFileToDisk(tmppath, text, err => { // stream to file
        if (err) return callback(err)
        fs.rename(tmppath, filepath, err => {
          if (err) return callback(err)
          callback(null, digest)          
        }) 
      }) 
    })
  }

  async storeAsync(object) {
    return Promise.promisify(this.store).bind(this)(object)
  }

  retrieve(digest, callback) {
    let filepath = path.join(this.docdir, digest)
    fs.readFile(filepath, (err, data) => {
      if (err) return callback(err)
      try {
        callback(null, JSON.parse(data.toString()))
      }
      catch (e) {
        callback(e)
      }
    })
  }

  async retrieveAsync(digest) {
    return Promise.promisify(this.retrieve).bind(this)(digest)
  }

}

module.exports = DocStore