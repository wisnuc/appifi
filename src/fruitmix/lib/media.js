import UUID from 'node-uuid'
import validator from 'validator'

/**

  a share doc

  {
    doctype: 'mediashare',
    docversion: '1.0'

    uuid: xxxx,

    author: xxxx,
*   maintainers: [], // 0..n 
*   viewers: [], // 0..n

*   album: null or object { title, text }
*   sticky: true or false,
    
    ctime: xxxx,
    mtime: xxxx,

    contents: [
      {
*       digest: xxxx
        creator: xxxx
        ctime: xxxx
      }
    ]
  }

  a share object 
  {
    digest: xxx
    doc: {
      ... // a share doc
    }
  }
**/

const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false
const isSHA1 = (sha1) => (typeof sha1 === 'string') ? /[a-f0-9]{64}/.test(sha1) : false

// this function generate a mediashare doc
const createMediaShareDoc = (userUUID, obj) => {

  let { maintainers, viewers, album, sticky, contents } = obj

  // FIXME
  maintainers = []

  if (!Array.isArray(viewers)) viewers = []

  // validate, sort, dedup, and must not be the user itself
  viewers = viewers
    .filter(viewer => viewer !== userUUID) 
    .filter(isUUID)
    .sort()
    .filter((item, index, array) => !index || item !== array[index - 1])

  // album must be true or false, defaults to false
  if (!album) album = null
  //  {
  //    title: string
  //    text: string
  //  }

  // sticky must be true or false, defaults to false
  if (typeof sticky !== 'boolean') sticky = false

  if (!Array.isArray(contents)) 
    contents = []
  else {

    let time = new Date().getTime()
    contents = contents
      .filter(isSHA1)
      .filter((item, index, array) => index === array.indexOf(item))
      .map(digest => ({
        author: userUUID,
        digest,
        time
      }))
  }

  if (!contents.length) {
    let error = new Error('contents invalid')
    error.code = 'EINVAL'
    return error
  }

  let time = new Date().getTime()

  return {
    doctype: 'mediashare',
    docversion: '1.0',
    uuid: UUID.v4(),
    author: userUUID,
    maintainers,
    viewers,
    album,
    sticky,
    ctime: time,
    mtime: time,
    contents
  }
}

class Media {

  // shareMap stores uuid (key) => share (value)
  // mediaMap stores media/content digest (key) => (containing) share Set (value), each containing share Set contains share
  constructor(shareStore, talkStore) {

    this.shareStore = shareStore
    this.talkStore = talkStore

    // using an map instead of an array
    this.shareMap = new Map()
    // using an map instead of an array
    this.mediaMap = new Map()
    // each (local) talk has its creator and media digest, as its unique identifier
    this.talks = []
    // each remote talk has its viewer (a local user), creator, and media digest, as its unique identifier
    this.remoteMap = new Map()      // user -> user's remote talks
                                    // each talsk has creator and media digest as its unique identifier
  }

  // add a share to index maps
  indexShare(share) {
    this.shareMap.set(share.doc.uuid, share)
    share.doc.contents.forEach(item => {
      let shareSet = this.mediaMap.get(item.digest)
      if (shareSet) {
        shareSet.add(share)
      }
      else {
        shareSet = new Set()
        shareSet.add(share)
        this.mediaMap.set(item.digest, shareSet)
      }
    })
  }

  // remove a share out of index maps
  unindexShare(share) {
    this.shareMap.delete(share.doc.uuid)
    share.doc.contents.forEach(item => {
      let shareSet = this.mediaMap.get(item.digest)
      shareSet.delete(share) 
    })
  }

  // create a mediashare object from user provided object
  // FIXME permission check
  createMediaShare(userUUID, obj, callback) {
  try{
    let doc = createMediaShareDoc(userUUID, obj)
    if (doc instanceof Error) {
      return process.nextTick(callback, doc)
    }

    this.shareStore.store(doc, (err, share) => {
      if (err) return callback(err)
      this.indexShare(share)      
      callback(null, doc)
    })
  } catch (e) {
    console.log(e)
  }
  }

  // archive a mediashare and unindex
  deleteMediaShare(uuid, callback) {

    this.shareStore.archive(uuid, err => {
      if (err) return callback(err)
      share.contents.forEach(cont => {
        let shareSet = this.mediaMap.get(cont.digest)
        if (!shareSet) throw new Error('structural error')
        shareSet.delete(share)
        if (shareSet.size === 0) { // the last entries for this media's shareSet has been removed
          this.mediaMap.delete(cont.digest)
        }
      })

      this.shareMap.delete(uuid) 
      callback(null)
    })
  }

  // my share is the one I myself is the creator
  // locally shared to me is the one that I am the viewer but not creator, the creator is a local user
  // remotely shared to me is the one that I am the viewer but not creator, the creator is a remote user
  getUserShares(userUUID) {

    let shares = []
    this.shareMap.forEach((value, key, map) => {
      let share = value
      if (share.doc.author === userUUID || 
          share.doc.maintainers.find(u => u === userUUID) || 
          share.doc.viewers.find(u => u === userUUID)) 
        shares.push(share) 
    })
    return shares
  }
  
  // retrieves all media talks I can view
  getMediaTalks(userUUID) {

    let localTalks = []
    this.mediaMap.forEach((value, key, map) => {
      let shareSet = value
      // first, the user must be either creator or viewer
      // second, if he is creator, get the whole mediatalk
      // if he is not the creator, get only the part he can view
      // push to queue
    })
    return localTalks + remoteTalks
  }
}



export default (shareStore, talkStore) => new Media(shareStore, talkStore)
