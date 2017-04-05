import path from 'path'
import fs from 'fs'
import mkdirp from 'mkdirp'

import { writeFileToDisk } from './util'
import { DIR } from './const'

class ShareStore {

  constructor(rootdir, arcdir, tmpdir, docstore) {
    this.rootdir = rootdir
    this.arcdir = arcdir
    this.tmpdir = tmpdir
    this.docstore = docstore
  }

  store(doc, callback) {

    let uuid = doc.uuid
    this.docstore.store(doc, (err, digest) => {
      if (err) return callback(err)
      let tmppath = path.join(this.tmpdir, uuid) 
      let dstpath = path.join(this.rootdir, uuid)
      writeFileToDisk(tmppath, digest, err => {
        if (err) return callback(err)
        fs.rename(tmppath, dstpath, err => {
          if (err) return callback(err)
          callback(null, digest)
        })
      })
    }) 
  }

  // async storeAsync(doc) {

  //   // return new Promise((resolve, reject) => 
  //   //   this.store(doc, (err, digest) => 
  //   //     err ? reject(err) : resolve(digest)))
    
  //   // await Promise.promisify(this.store, { context: this })
  //   // or 
  //   return Promise.promisify(this.store).bind(this)(doc)
  // }

  archive(uuid, callback) {
    let srcpath = path.join(this.rootdir, uuid)
    let dstpath = path.join(this.arcdir, uuid)
    fs.rename(srcpath, dstpath, err => callback(err))
  }

  // async archiveAsync(uuid) {
  //   Promise.promisify(this.archive).bind(this)(uuid)
  // }

  retrieve(uuid, callback) {
    let srcpath = path.join(this.rootdir, uuid)
    fs.readFile(srcpath, (err, data) => {
      if (err) return callback(err)  
      let digest = data.toString()
      this.docstore.retrieve(digest, (err, doc) => {
        if (err) return callback(err)
        callback(null, { digest , doc })
      })
    })
  }

  retrieveAll(callback) {

    fs.readdir(this.rootdir, (err, entries) => {
      if (err) return callback(err)

      let count = entries.length
      if (!count) return callback(null, [])

      let result = []
      entries.forEach(entry => {
        this.retrieve(entry, (err, obj) => {
          if (!err) result.push(obj)
          if (!--count) callback(null, result)
        })
      })
    })
  }
}

const createShareStore = (rootdir, arcdir, tmpdir, docstore, callback) => {
    mkdirp(rootdir, err => {
    if(err) return callback(err)
    mkdirp(arcdir, err => {
      if(err) return callback(err)
      mkdirp(tmpdir, err => {
        if(err) return callback(err)
        callback(null, new ShareStore(rootdir, arcdir, tmpdir, docstore))
      })
    })
  })
}

const createMediaShareStore = (froot, docstore, callback) => {
  let rootdir = path.join(froot, DIR.MSHARE)
  let arcdir = path.join(froot, DIR.MSHAREARC)
  let tmpdir = path.join(froot, DIR.TMP)

  createShareStore(rootdir, arcdir, tmpdir, docstore, callback)
}

const createFileShareStore = (froot, docstore, callback) => {
  let rootdir = path.join(froot, DIR.FSHARE)
  let arcdir = path.join(froot, DIR.FSHAREARC)
  let tmpdir = path.join(froot, DIR.TMP)

  createShareStore(rootdir, arcdir, tmpdir, docstore, callback)
}

const createFileShareStoreAsync = Promise.promisify(createFileShareStore)

export { 
  createMediaShareStore,
  createFileShareStore,
  createFileShareStoreAsync
}

