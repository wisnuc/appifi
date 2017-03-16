// for all operations, user should be valid, shareUUID should be validated by caller (rest router)

import { isUUID, isSHA256, complement } from '../lib/types'
import E from '../lib/error'
import { mediaShareAllowed } from './mediaData' // TODO

const dedupe = (isType) => {
  return (arr) => {
    let validArr = arr.filter(isType)
    return Array.from(new Set(validArr))
  }
}


class MediaShareOperations {

  constructor(forest, mediaShareCollection) {
    this.forest = forest
    this.msc = mediaShareCollection
  }

  // return { digest, doc } // for compatibility
  // post should be non-null js object
  async createMediaShare(user, post) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(typeof post !== 'object' || post === null) throw new E.EINVAL()

    let {maintainers, viewers, album, contents} = post

    // contents (format and permission check)
    if(!Array.isArray(contents)) throw new E.EINVAL()
    contents = dedupe(isSHA256)(contents)
    if(!contents.length) throw new E.EINVAL()
    if(contents.every(digest => mediaShareAllowed(user, digest))) throw new E.EACCESS()

    // maintainers check
    if(!Array.isArray(maintainers)) maintainers = []
    maintainers = dedupe(isUUID)(maintainers).filter(maintainer => maintainer !== user)

    // veiwers check
    if(!Array.isArray(viewers)) viewers = []
    viewers = dedupe(isUUID)(viewers).filter(viewers => viewers !== user)
    viewers = complement(viewers, maintainers)

    // album check 
    if(typeof album === 'object' && album !== null) {
      let title, text
      title = typeof album.title === 'string' ? album.title : ''
      if(album.hasOwnProperty('text')) {
        text = typeof album.text === 'string' ? album.title : ''
        album = {title, text}
      } 
      else album = {title}
    }
    else album = null

    post = {maintainers, veiwers, album, contents}
    return await this.msc.createMediaShare(user, post)
  } 

  // return { digest, doc } // for compatibility 
  // patch should be non-null js object
  async updateMediaShare(user, shareUUID, patch) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(!isUUID(shareUUID)) throw new E.EINVAL()
    let share = this.msc.shareMap.get(shareUUID)
    if(!share) throw new E.ENOENT()
    if(share.doc.author !== user && share.doc.maintainers.indexOf(userUUID) === -1) throw new E.EACCESS()
    
  } 

  // return undefined, never fail, idempotent
  async deleteMediaShare(user, shareUUID) {
  }
}

////

const testData = Map.from([
  [uuid, { digest, doc, lock: true }]
])

deepFreeze(testData)


describe(() => {

  let msc = new MediaShareCollection(shareStore)
  msc.shareMap = testData

  msc.updatre
})


const shareStore = {
  async storeAsync(doc) {
    return 'xxxx'
  }
}
