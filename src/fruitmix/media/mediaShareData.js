//
// This file provides mediaShare class, which refers to mediaShareDoc internally.
// mediaShare class is responsible for 

// class: mediashare, doc
// singleton: mediashare collection (class -> singleton)
//
// external 
import EventEmitter from 'events'
import deepFreeze from 'deep-freeze'

import { validateMediaShareDoc } from './mediaShareDoc'
import E from '../lib/error'
import { assert } from '../lib/types'

/**
  indexShare(share) {

    this.shareMap.set(share.doc.uuid, share)

    share.doc.contents.forEach(item => {
      let shareSet = this.mediaMap.get(item.digest)
      if(shareSet) {
        shareSet.add(share)
      } else {
        shareSet = new Set()
        shareSet.add(share)
        this.mediaMap.set(item.digest, shareSet)
      }
    })
  }
**/

/**
  unIndexShare(share) {

    share.doc.contents.forEach(item => {
      let shareSet = this.mediaMap.get(item.digest)
      shareSet.delete(share)
    })

    this.shareMap.delete(share.doc.uuid)
  }
**/

/**
  a share object 
  {
    digest: xxx
    doc: {
      ... // a share doc
    }
    lock: true or undefined // default to undefined
  }
**/

class MediaShare {

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
    'doctype', 'docversion', 'uuid', 'author',
    'sticky', 'ctime'
  ])

  c.contents.forEach(cc => {
    let nc = n.contents.find(x => x.digest === cc.digest)
    if (nc) {
      invariantProps(cc, nc, ['creator', 'ctime'])
    }
  })  
}

class MediaShareData extends EventEmitter {

  constructor(model, shareStore) {
    super()
    this.model = model 
    this.shareStore = shareStore
    this.shareMap = new Map()
    this.lockSet = new Set()
  }

  getLock(uuid) {
    if (this.lockSet.has(uuid)) throw new E.ELOCK()
    this.lockSet.add(uuid)    
  }

  putLock(uuid) {
    if (!this.lockSet.has(uuid)) throw new E.ELOCK()
    this.lockSet.delete(uuid)
  }

  async storeAsync(doc) {

    this.getLock(doc.uuid)
    try {
      return await this.shareStore.storeAsync(doc)   
    }
    finally {
      this.putLock(doc.uuid)
    }
  }

  async archiveAsync(uuid) {

    this.getLock(uuid)
    try {
      return await this.shareStore.archiveAsync(uuid)
    }
    finally {
      this.putLock(uuid)
    }
  } 

  async createMediaShare(doc) {
    validateMediaShareDoc(doc, this.model.getUsers())

    let digest = await this.storeAsync(doc)
    let share = new MediaShare(digest, doc)

    this.shareMap.set(doc.uuid, share)
    this.emit('mediaShareCreated', share)
    return share
  }

  async updateMediaShare(doc) {
    validateMediaShareDoc(doc, this.model.getUsers())

    let share = this.shareMap.get(doc.uuid)
    if (!share) throw new E.ENOENT() // 'uuid not found'

    invariantUpdate(share.doc, doc)

    let digest = await this.storeAsync(doc) 
    let next = new MediaShare(digest, doc)
   
    this.emit('mediaShareUpdating', share, next)
    this.shareMap.set(doc.uuid, next)
    this.emit('mediaShareUpdated', share, next)
    return next
  }

  async deleteMediaShare(uuid) {

    let share = this.shareMap.get(uuid)
    if (!share) throw new E.ENOENT() // 'uuid not found'

    await this.archiveAsync(uuid) 

    this.emit('mediaShareDeleting', share)
    this.shareMap.delete(uuid)
  }
}

const createMediaShareData = (model, shareStore) => {
  Promise.promisifyAll(shareStore)
  return new MediaShareData(model, shareStore)
}

export { createMediaShareData }
