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

  constructor(model, fileShareStore) {
    super()
    this.model = model
    this.fss = fileShareStore
    this.fsMap = new Map()
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