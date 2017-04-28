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

  userAuthorizedToRead(userUUID) {
    return [...this.doc.maintainers, ...this.doc.viewers].includes(userUUID)
  }

  userAuthorizedToWrite(userUUID) {
    return [...this.doc.maintainers].includes(userUUID)
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

  constructor(model, mediaShareStore) {
    super()
    this.model = model 
    this.mediaShareStore = mediaShareStore
    this.mediaShareMap = new Map()
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
      return await this.mediaShareStore.storeAsync(doc)   
    }
    finally {
      this.putLock(doc.uuid)
    }
  }

  async archiveAsync(uuid) {

    this.getLock(uuid)
    try {
      return await this.mediaShareStore.archiveAsync(uuid)
    }
    finally {
      this.putLock(uuid)
    }
  } 

  findShareByUUID(uuid) {
    return this.mediaShareMap.get(uuid)
  }

  async load() {
    let shares = await this.mediaShareStore.retrieveAllAsync()
    shares.forEach(share => {
      this.mediaShareMap.set(share.doc.uuid, share)
    })
    this.emit('mediaShareCreated', shares)
  }

  async createMediaShare(doc) {
    validateMediaShareDoc(doc, this.model.getUsers())

    let digest = await this.storeAsync(doc)
    let share = new MediaShare(digest, doc)

    this.mediaShareMap.set(doc.uuid, share)
    this.emit('mediaShareCreated', [share])
    return share
  }

  async updateMediaShare(doc) {
    validateMediaShareDoc(doc, this.model.getUsers())

    let share = this.findShareByUUID(doc.uuid)
    if (!share) throw new E.ENOENT() // 'uuid not found'

    invariantUpdate(share.doc, doc)

    let digest = await this.storeAsync(doc) 
    let next = new MediaShare(digest, doc)
   
    this.emit('mediaShareUpdating', share, next)
    this.mediaShareMap.set(doc.uuid, next)
    this.emit('mediaShareUpdated', share, next)
    return next
  }

  async deleteMediaShare(uuid) {

    let share = this.findShareByUUID(uuid)
    if (!share) throw new E.ENOENT() // 'uuid not found'

    await this.archiveAsync(uuid) 

    this.emit('mediaShareDeleting', share)
    this.mediaShareMap.delete(uuid)
  }

  // return all the shares user can view
  async getUserMediaShares(userUUID) {
    let shares = []
    this.mediaShareMap.forEach((value, key, map) => {
      if (value.doc.author === userUUID || 
          value.doc.maintainers.includes(userUUID) || 
          value.doc.viewers.includes(userUUID)) 
        shares.push(value)
    })
    return shares
  }

  sharedWithOthers(userUUID, shareUUID) {
    let share = this.findShareByUUID(shareUUID) 
    return share.doc.author === userUUID
  }

  sharedWithMe(userUUID, shareUUID) {
    let share = this.findShareByUUID(shareUUID) 
    return share.doc.maintainers.includes(userUUID) 
      || share.doc.viewers.includes(userUUID) 
  }
}

const createMediaShareData = (model, mediaShareStore) => {
  Promise.promisifyAll(mediaShareStore)
  return new MediaShareData(model, mediaShareStore)
}

export { createMediaShareData }
