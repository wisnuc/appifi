import path from 'path'
import fs from 'fs'

import UUID from 'node-uuid'

import { writeFileToDisk } from './util'

class MediaTalkStore {

  constructor(rootdir, tmpdir, docstore) {
    this.rootdir = rootdir
    this.tmpdir = tmpdir
    this.docstore = docstore
  }

  store(doc, callback) {
    let name = doc.owner + '.' + doc.digest
    this.docstore.store(doc, (err, digest) => {
      if (err) return callback(err)
      let tmppath = path.join(this.tmpdir, UUID.v4())
      let dstpath = path.join(this.rootdir, name)
      writeFileToDisk(tmppath, digest, err => {
        if (err) return callback(err)
        fs.rename(tmppath, dstpath, err => {
          if (err) return callback(err)
          callback(null, { digest, doc })
        })
      })
    })
  }

  retrieve(owner, digest, callback) {
    let srcpath = path.join(this.rootdir, owner + '.' + digest)
    fs.readFile(srcpath, (err, data) => {
      if (err) return callback(err)
      let digest = data.toString()
  
      this.docstore.retrieve(digest, (err, doc) => {
        if (err) return callback(err)
        callback(null, { digest, doc })
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

const createMediaTalkStore = (rootdir, tmpdir, docstore) => 
  new MediaTalkStore(rootdir, tmpdir, docstore)

export { createMediaTalkStore }
