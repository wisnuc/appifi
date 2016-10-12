import path from 'path'
import fs from 'fs'

import validator from 'validator'

import { writeFileToDisk } from './util'
import paths from './paths'

class MediaShareStore {

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
          callback(null, { digest, doc })
        })
      })
    }) 
  }

  archive(uuid, callback) {
    let srcpath = path.join(this.rootdir, uuid)
    let dstpath = path.join(this.arcdir, uuid)
    fs.rename(srcpath, dstpath, err => callback(err))
  }

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

const createMediaShareStore = (docstore) => {

  let rootdir = paths.get('mediashare') 
  let arcdir = paths.get('mediashareArchive')
  let tmpdir = paths.get('tmp')
  
  return new MediaShareStore(rootdir, arcdir, tmpdir, docstore)
}

export { createMediaShareStore }

