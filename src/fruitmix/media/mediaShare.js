//
// This file provides mediaShare class, which refers to mediaShareDoc internally.
// mediaShare class is responsible for 

// class: mediashare, doc
// singleton: mediashare collection (class -> singleton)
//
// external 
import crypto from 'crypto'
import EventEmitter from 'events'

import validator from 'validator'
import deepEqual from 'deep-equal'
import deepFreeze from 'deep-freeze'

import { createMediaShareDoc, updateMediaShareDoc } from 'src/fruitmix/media/mediaShareDoc'
import E from '../lib/error'

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

// const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false
// const isSHA256 = (sha256) => (typeof sha256 === 'string') ? /[a-f0-9]{64}/.test(sha256) : false
// const EInvalid = (text) => Object.assign((new Error(text || 'invalid args')), { code: 'EINVAL' })

// const dedupe = (isType) => {
//   return (arr) => {
//     let validArr = arr.filter(isType)
//     return Array.from(new Set(validArr))
//   }
// }

// const addUUIDArray = (a, b) => {
//   let c = dedupe(isUUID)([...a, ...b])
//   return deepEqual(a, c) ? a :c
// }

// // remove the element in a which already exist in b
// const subtractUUIDArray = (a, b) => {
//   let aa = [...a]
//   let dirty = false

//   b.forEach(item => {
//     let index = aa.indexOf(item)
//     if (index !== -1) {
//       dirty = true
//       aa.splice(index, 1) 
//     }
//   }) 

//   return dirty ? aa : a
// }


class MediaShareCollection extends EventEmitter {

  constructor(shareStore) {
    super()
    this.shareStore = shareStore
    this.shareMap = new Map()
  }

  load() {
    this.shareStore.retrieveAll((err, shares) => {
      shares.forEach(share => {
        this.shareMap.set(share.doc.uuid, share)
        this.emit('create', share)
      })
    }) 
  }

  async createMediaShare(userUUID, post) {
    let err, share
    this.shareStore.storeAsync = Promise.promisify(this.shareStore.store)

    try {
      let doc = createMediaShareDoc(userUUID, post)
      deepFreeze(doc)
      let digest = await this.shareStore.storeAsync(doc)

      share = {digest, doc}
      this.shareMap.set(doc.uuid, share)
      this.emit('create', share)
    }
    catch(e) {
      err = e
    }

    if(err) throw err
    return share
  }

  // createMediaShare(userUUID, obj, callback) {
  //   if(!isUUID(userUUID))
  //     return process.nextTick(() => callback(EInvalid('invalid userUUID')))

  //   try {
  //     // create doc
  //     let doc = createMediaShareDoc(userUUID, obj)
  //     if(doc instanceof Error) {
  //       return process.nextTick(callback, doc)
  //     }

  //     this.shareStore.store(doc, (err, share) => {
  //       if(err) return callback(err)
  //       this.indexShare(share)
  //       this.emit('create', share)
  //       callback(null, share)
  //     })
  //   } catch(e) {
  //     console.log(e)
  //   }
  // }

  async updateMediaShare(userUUID, shareUUID, patch) {

    let err, updatedShare
    this.shareStore.storeAsync = Promise.promisify(this.shareStore.store)

    let share = this.shareMap.get(shareUUID)
    let { digest, doc } = share

    if (share.lock) throw new E.ELOCK()
    share.lock = true

    try {
      doc = updateMediaShareDoc(userUUID, share.doc, patch)
      deepFreeze(doc)

      if (doc !== share.doc) {
        digest = await this.shareStore.storeAsync(doc)

        updatedShare = {digest, doc}

        this.shareMap.set(shareUUID, updatedShare)
        this.emit('update', updatedShare)
      }
    }
    catch(e) {
      err = e
    }
    finally {
      share.lock = false 
    }

    if (err) throw err
    return updatedShare
  }

  // updateMediaShare(userUUID, shareUUID, ops, callback){
  //   if(!isUUID(userUUID))
  //     return process.nextTick(() => callback(EInvalid('invalid userUUID')))
  //   if(!isUUID(shareUUID))
  //     return process.nextTick(() => callback(EInvalid('invalid shareUUID')))
  //   if(!Array.isArray(ops))
  //     return process.nextTick(() => callback(EInvalid('ops should be an array')))

  //   try {
  //     let share = this.shareMap.get(shareUUID)
  //     if(!share) {
  //       let error = Object.assign((new Error('share non-exist')), {code: 'ENOENT'})
  //       return process.nextTick(() => callback(error))
  //     }

  //     if(share.doc.author !== userUUID && share.doc.maintainers.indexOf(userUUID) === -1) {
  //       let error = Object.assign((new Error('no permission')), {code: 'EACCESS'})
  //       return process.nextTick(() => callback(error))
  //     }

  //     if(share.lock) {
  //       let error = Object.assign((new Error('busy')), {code: 'EBUSY'})
  //       return process.nextTick(() => callback(error))
  //     }
  //     else {
  //       share.lock = true
  //       this.shareMap.set(shareUUID, share)

  //       let newDoc = updateMediaShareDoc(userUUID, share.doc, ops)

  //       if(newDoc === share.doc) {
  //         delete share.lock
  //         this.shareMap.set(shareUUID, share)
  //         return process.nextTick(() => callback(null, share))
  //       }

  //       this.shareStore.store(newDoc, (err, newShare) => {
  //         if(err) return callback(err)
  //         this.unIndexShare(share)
  //         this.indexShare(newShare)
  //         this.emit('update', share, newShare)
  //         callback(null, newShare)
  //       })
  //     }
  //   } catch(e) {
  //     console.log(e)
  //   }
  // }

  async deleteMediaShare(shareUUID) {
    let err
    let archiveAsync = Promise.promisify(this.shareStore.archive)

    let share = this.shareMap.get(shareUUID)
    if (share.lock) throw new E.ELOCK()

    try {
      await archiveAsync(shareUUID)
      this.shareMap.delete(shareUUID)
      this.emit('delete', share)
    }
    catch(e) {
      err = e
    }
    
    if(err) throw err

  }

  // deleteMediaShare(userUUID, shareUUID, callback) {
  //   if(!isUUID(userUUID))
  //     return process.nextTick(() => callback(EInvalid('invalid userUUID')))
  //   if(!isUUID(shareUUID))
  //     return process.nextTick(() => callback(EInvalid('invalid shareUUID')))

  //   try {
  //     let share = this.shareMap.get(shareUUID)
  //     if(!share) {
  //       let error = Object.assign((new Error('share non-exist')), {code: 'ENOENT'})
  //       return process.nextTick(() => callback(error))
  //     }

  //     if(share.doc.author !== userUUID) {
  //       let error = Object.assign((new Error('no permission')), {code: 'EACCESS'})
  //       return process.nextTick(() => callback(error))
  //     }

  //     if(share.lock) {
  //       let error = Object.assign((new Error('busy')), {code: 'EBUSY'})
  //       return process.nextTick(() => callback(error))
  //     }

  //     this.shareStore.archive(shareUUID, err => {
  //       if(err) return callback(err)
  //       this.unIndexShare(share)
  //       this.emit('delete', share)
  //       callback(null)
  //     })
  //   } catch(e) {
  //     console.log(e)
  //   }
  // }

}

export default (shareStore) => {
  let mediaShare = new MediaShareCollection(shareStore)
  mediaShare.load()
  return mediaShare
}

/**

  let shareShare = new ...

  let msc = new MediaShareCollection(shareStore)
  msc.on('create', share => {})
  msc.on('update', (oldShare, newShare) => {})
  msc.on('delete', share)
  msc.load()

**/


