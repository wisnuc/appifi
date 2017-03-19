// for all operations, user should be valid, shareUUID should be validated by caller (rest router)

import { isUUID, isSHA256, complement, validateProps } from '../lib/types'
import E from '../lib/error'
import { shareAllowed } from './shareAllowed' // TODO
import { createMediaShareDoc, updateMediaShareDoc } from './mediaShareDoc'

class MediaShareService {

  constructor(mediaShareData) {
    this.msd = mediaShareData
  }

  // return { digest, doc } // for compatibility
  // post should be non-null js object
  async createMediaShare(user, post) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(typeof post !== 'object' || post === null) throw new E.EINVAL()

    validateProps(post, ['maintainers', 'veiwers', 'album', 'contents'])

    let {maintainers, veiwers, album, contents} = post
    // contents format and permission check
    if(!Array.isArray(contents)) throw new E.EINVAL()
    if(!contents.length) throw new E.EINVAL()
    if(!contents.every(isSHA256)) throw new E.EINVAL()
    if(!contents.every(digest => shareAllowed.mediaShareAllowed(user, digest))) throw new E.EACCESS()

    // maintainers format check
    if(!Array.isArray(maintainers)) throw new E.EINVAL()
    if(!maintainers.every(isUUID())) throw new  E.EINVAL()

    // viewers format check
    if(!Array.isArray(viewers)) throw new E.EINVAL()
    if(!viewers.every(isUUID())) throw new  E.EINVAL()

    // album format check
    if(typeof album !== 'object') throw new E.EINVAL()
    if(album) {
      validateProps(album, ['title'], ['text'])
      if(typeof album.title !== 'string') throw new E.EINVAL()
      if(album.hasOwnProperty('text')) {
        if(typeof album.text !== 'string') throw new E.EINVAL()
      }
    }

    let doc = createMediaShareDoc(user, post)
    await this.msd.createMediaShare(doc)
  } 

  // return { digest, doc } // for compatibility 
  // patch should be non-null js object
  async updateMediaShare(user, shareUUID, patch) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(!isUUID(shareUUID)) throw new E.EINVAL()

    let share = this.msd.shareMap.get(shareUUID)
    if(!share) throw new E.ENOENT()
    if(share.doc.author !== user && share.doc.maintainers.indexOf(userUUID) === -1) throw new E.EACCESS()
    
    if(!Array.isArray(patch)) throw new E.EINVAL()
    patch.forEach(op => {
      if(typeof op !== 'object') throw new E.EINVAL()

      validateProps(op, ['path', 'operation', 'value'])

      if(complement([op.path], ['maintainers', 'veiwers', 'album', 'contents']).length !== 0)
        throw new E.EINVAL()

      if(complement([op.path], ['maintainers', 'veiwers', 'contents']).length === 0) {
        if(op.operation !== 'add' || op.operation !== 'delete') throw new E.EINVAL()
        if(!Array.isArray(op.value)) throw new E.EINVAL()
        if(op.path === 'contents') {
          if(!op.value.every(isSHA256)) throw new E.EINVAL()
          if(!op.value.every(digest => mediaShareAllowed(user, digest))) throw new E.EACCESS()
        }
        else {
          if(!op.value.every(isUUID)) throw new E.EINVAL()
        }
      }
      else {
        if(op.operation !== 'update') throw new E.EINVAL()
        if(typeof op.value !== 'object') throw new E.EINVAL()
        if(op.value) {
          validateProps(op.value, ['title'], ['text'])
          if(typeof op.value.title !== 'string') throw new E.EINVAL()
          if(op.value.hasOwnProperty('text')) {
            if(typeof op.value.text !== 'string') throw new E.EINVAL()
          }
        }
      }
    })

    let newDoc = updateMediaShareDoc(user, share.doc, patch)
    await this.msd.updateMediaShare(newDoc)
  } 

  // return undefined, never fail, idempotent
  async deleteMediaShare(user, shareUUID) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(!isUUID(shareUUID)) throw new E.EINVAL()

    let share = this.msd.shareMap.get(shareUUID)
    if(!share) throw new E.ENOENT()
    if(share.doc.author !== user) throw new E.EACCESS()

    await this.msd.deleteMediaShare(shareUUID)
  }
}

const createMediaShareService = (msd) => { 
  return new MediaShareService(msd)
}

export { createMediaShareService }

