import EventEmitter from 'events'
import deepFreeze from 'deep-freeze'

import { validateFileShareDoc } from './fileShareDoc'
import E from '../lib/error'
import { assert } from '../lib/types'

class FileShare {

  constructor(digest, doc) {
    this.digest = digest
    this.doc = doc

    deepFreeze(this)
  }

  userAuthorizedToRead(userUUID) {
  }

  userAuthorizedToWrite(userUUID) {
  }

  // filter collection
  effective() {
  }
}

const invariantProps = (c, n, props) => {
  props.forEach(prop => {
    assert(c[prop] === n[prop], 'invariant has changed')
  })
}

const invariantUpdate = (c, n) => {
  invariantProps(c, n, [
    'doctype', 'docversion', 'uuid', 'author', 'ctime'
  ])
}

class FileShareData extends EventEmitter {

  constructor(model, fileShareStore, fileData) {
    super()
    this.model = model
    this.fss = fileShareStore
    this.fsMap = new Map()
    this.fileData = fileData
  }

  userAuthorizedToRead(userUUID, node) { // starting from root
    // 1. filter user in ReaderSet and user is not author
    // 2. iterate collection list, find one in nodepath && effective

    let arr = [...this.fsMap]

    for (let i = 0; i < arr.length; i++) {
      if (arr[0].authorizedRead(userUUID)) {
        let collection

        let found = collection.find(item => {
          nodepath.includes(item) && 
          this.fileData.userReadable(userUUID, item.uuid)
        })

        if (found) return true
      }

    }
    return false
  }

  userAuthorizedToWrite(userUUID, node) {
  }

  async createFileShare(doc) {
    validateFileShareDoc(doc, this.model.getUsers())

    let digest = await this.fss.storeAsync(doc)
    let fileShare = new FileShare(digest, doc)

    this.fsMap.set(doc.uuid, fileShare)
    this.emit('fileShareCreated', fileShare)
    return fileShare
  }

  async updateFileShare(doc) {
    validateFileShareDoc(doc, this.model.getUsers())

    let share = this.fsMap.get(doc.uuid)
    if(!share) throw new E.ENOENT()

    invariantUpdate(share.doc, doc)

    let digest = await this.fss.storeAsync(doc)
    let next = new FileShare(digest, doc)

    this.emit('fileShareUpdating', share, next)
    this.fsMap.set(doc.uuid, next)
    this.emit('fileShareUpdated', share, next)
    return next
  }

  async deleteFileShare(uuid) {
    let share = this.fsMap.get(uuid)
    if(!share) throw new E.ENOENT()

    await this.fss.archiveAsync(uuid)

    this.emit('fileShareDeleting', share)
    this.fsMap.delete(uuid)
  }
}

const createFileShareData = (model, fileShareStore) => {
  Promise.promisifyAll(fileShareStore)
  return new FileShareData(model, fileShareStore)
}

export { createFileShareData }
