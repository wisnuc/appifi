import crypto from 'crypto'
import EventEmitter from 'events'

import UUID from 'node-uuid'
import validator from 'validator'
import deepEqual from 'deep-equal'

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
    viewerSet: a Set // a combination of author, maintainers and viewers
    lock: true of false
  }
**/

const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false
const isSHA256 = (sha256) => (typeof sha256 === 'string') ? /[a-f0-9]{64}/.test(sha256) : false
const EInvalid = (text) => 
  Object.assign((new Error(text || 'invalid args')), { code: 'EINVAL' })

const sortDedupe = (isType) => {
  return (arr) => {
    return [...arr]
      .filter(isUUID)
      .sort()
      .filter((item, index, arr) => !index || item !== arr[index - 1])
  }
}

const addUUIDArray = (a, b) => {
  let c = sortDedupe(isUUID)([...a, ...b])
  return deepEqual(a, c) ? a :c
}

// remove the element in a which already exist in b
const subtractUUIDArray = (a, b) => {
  let aa = [...a]
  let dirty = false

  b.forEach(item => {
    let index = aa.indexOf(item)
    if (index !== -1) {
      dirty = true
      aa.splice(index, 1) 
    }
  }) 

  return dirty ? aa : a
}

// generate a mediashare doc
const createMediaShareDoc = (authorUUID, obj) => {

  let {maintainers, viewers, album, sticky, contents} = obj

  // validate, sortDedupe, and mustn't be the author itself
  if(!Array.isArray(maintainers)) maintainers = []

  maintainers = sortDedupe(isUUID)(maintainers).filter(maintainer => maintainer !== authorUUID) // remove author itself

  // validate, sortDedupe, and mustn't be the author itself
  if(!Array.isArray(viewers)) viewers = []

  viewers = sortDedupe(isUUID)(viewers).filter(viewer => viewer !== authorUUID) // remove author itself
  viewers = subtractUUIDArray(viewers, maintainers)

  // album must be true or false, default to false
  if(!album) album = null
  else {
    // {
    //   title : string
    //   text : string
    // }
    let obj = {}
    if(typeof album.title === 'string')
      obj.title = album.title
    else
      obj.title = ''

    if(typeof album.text === 'string')
      obj.text = album.text
    else
      obj.text = ''

    album = obj
  }

  // sticky must be true or false, default to false
  if(typeof sticky !== 'boolean') sticky = false

  // validate contents
  if(!Array.isArray(contents))
    contents = []
  else {
    let time = new Date().getTime()
    contents = contents
      .filter(isSHA256)
      .sort()
      .filter((item, index, array) => !index || item !== array[index - 1])
      .map(digest => {
        creator: authorUUID,
        digest,
        time
      })
    }

  if(!contents.length) {
    let error = Object.assign((new Error('invalid contents')), {code: 'EINVAL'})
    return error
  }

  let time = new Date().getTime()

  return {
    doctype: 'mediashare',
    docversion: '1.0',
    uuid: UUID.v4(),
    author: authorUUID,
    maintainers,
    viewers,
    album,
    sticky,
    ctime: time,
    mtime: time,
    contents
  }

}

// update a mediashare doc
// each op containes:
// {
//   path: 'maintainers', 'viewers', 'albun', 'sticky', or 'contents', describes which part to be modifed
//   operation: 'add', 'delete', or 'update'. add, delete for array, update for non-array
//   value: the elements to be updated
// }

const updateMediaShareDoc = (userUUID, doc, ops) => {

  let op
  let {maintainers, viewers, album, sticky, contents} = doc

  if(userUUID === doc.author) {

    op = ops.find(op.path === 'maintainers' && op.operation === 'add')
    if(op && Array.isArray(op.value))
      maintainers = addUUIDArray(maintainers, sortDedupe(isUUID)(op.value).filter(i => i !== doc.author))

    op = ops.find(op.path === 'maintainers' && op.operation === 'delete')
    if(op && Array.isArray(op.value))
      maintainers = subtractUUIDArray(maintainers, sortDedupe(isUUID)(op.value))

    op = ops.find(op.path === 'viewers' && op.operation === 'add')
    if(op && Array.isArray(op.value))
      viewers = addUUIDArray(viewers, sortDedupe(isUUID)(op.value).filter(i => i !== doc.author))
      viewers = subtractUUIDArray(viewers, maintainers) //dedupe

    op = ops.find(op.path === 'viewers' && op.operation === 'delete')
    if(op && Array.isArray(op.value))
      viewers = subtractUUIDArray(viewers, sortDedupe(isUUID)(op.value))

    op = ops.find(op.path === 'album' && op.operation === 'update')
    if(op && typeof op.value === 'object'){
      let title = typeof op.value.title === 'string' ? op.value.title : album.title
      let text = typeof op.value.text === 'string' ? op.value.text : album.text

      if(title !== album.title || text !== album.text) album = {title, text}
    }

    op = ops.find(op.path === 'sticky' && op.operation === 'update')
    if(op && typeof op.value === 'boolean' && op.value !== sticky)
      sticky = op.value
  }

  if(userUUID === doc.author || doc.maintainers.indexOf(userUUID) !== -1) {

    op = ops.find(op.path === 'contents' && op.operation === 'add')
    if(op && Array.isArray(op.value)) {
      let c = [...contents]
      let dirty = false

      sortDedupe(isSHA256)(op.value)
        .forEach(digest => {
          let index = c.findIndex(x => x.digest === digest)
          if(index !== -1) return

          dirty = true
          c.push({
            creator: userUUID,
            digest,
            time: new Date().getTime()
          })
        })

      if(dirty) contents = c
    }

    op = ops.find(op.path === 'contents' && op.operation === 'delete')
    if(op && Array.isArray(op.value)) {
      let c = [...contents]
      let dirty = false

      sortDedupe(isSHA256)(op.value)
        .forEach(digest => {
          let index = c.findIndex(x => x.digest === digest && (userUUID === doc.author || userUUID === x.creator))
          if(index !== -1) {
            c.splice(index, 1)
            dirty = true
          }
        })

      if(dirty) contents = c   
    }
  }

  if (maintainers === doc.maintainers &&
      viewers === doc.viewers &&
      album === doc.album &&
      sticky === doc.sticky &&
      contents === doc.contents){
    return doc
  }
  
  let update = {
    doctype: doc.doctype,
    docversion: doc.docversion,
    uuid: doc.uuid,
    author: doc.author,
    maintainers,
    viewers,
    album,
    sticky,
    ctime: doc.ctime,
    mtime: new Date().getTime(),
    contents
  }

  return update
}

class MediaShare extends EventEmitter {

  constructor(shareStore) {
    super()
    this.shareStore = shareStore
    this.shareMap = new Map()
    this.mediaMap = new Map()
    // this.lock = false
  }

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

  unIndexShare(share) {
    share.doc.contents.forEach(item => {
      let shareSet = this.mediaMap.get(item.digest)
      shareSet.delete(share)
    })
    this.shareMap.delete(share.doc.uuid)
  }

  load() {

    this.shareStore.retrieveAll((err, shares) => {
      shares.forEach(share => {
        this.indexShare(share)
      })
    }) 
  }

  createMediaShare(userUUID, obj, callback) {
    if(!isUUID(userUUID))
      return process.nextTick(callback(EInvalid('invalid uuid')))
    if(typeof obj !== 'object')
      return process.nextTick(callback(EInvalid()))

    try {
      // create doc
      let doc = createMediaShareDoc(userUUID, obj)
      if(doc instanceof Error) {
        return process.nextTick(callback, doc)
      }
      // calculate digest of doc
      // if(doc) 
      //   let digest = calcuSHA256(JSON.stringify(doc))
      // all the user who can access the mediaShare
      // let viewerList = [doc.author, ...doc.maintainers, ...doc.viewers]

      // let share = {
      //   digest,
      //   doc,
      //   viewerList,
      //   lock: false
      // }

      this.shareStore.store(doc, (err, share) => {
        if(err) return callback(err)
        this.indexShare(share)
        callback(null, share)
      })
    } catch(e) {
      console.log(e)
    }
  }

  updateMediaShare(userUUID, shareUUID, ops, callback){
    if(!isUUID(userUUID))
      return process.nextTick(callback(EInvalid('invalid userUUID')))
    if(!isUUID(shareUUID))
      return process.nextTick(callback(EInvalid('invalid shareUUID')))
    if(!Array.isArray(ops))
      return process.nextTick(callback(EInvalid()))

    try {
      let share = this.shareMap.get(shareUUID)
      if(!share) {
        let error = Object.assign((new Error('share non-exist'), {code: 'ENOENT'}))
        return process.nextTick(callback(error))
      }

      if(share.doc.author !== userUUID && share.doc.maintainers.indexOf(userUUID) === -1) {
        let error = Object.assign((new Error('no permission')), {code: 'EACCESS'})
        return process.nextTick(callback(error))
      }

      if(share.lock) {
        let error = Object.assign((new Error('busy')), {code: 'EBUSY'})
        return process.nextTick(callback(error))
      }
      else {
        share.lock = true
        this.shareMap.set(shareUUID, share)

        let newDoc = updateMediaShareDoc(userUUID, share.doc, ops)

        if(newDoc === share.doc) {
          delete share.lock
          this.shareMap.set(shareUUID, share)
          return process.nextTick(callback(null, share))
        }

        this.shareStore.store(newDoc, (err, newShare) => {
          if(err) return callback(err)
          this.unIndexShare(share)
          this.indexShare(newShare)
          callback(null, newShare)
        })
      }
    } catch(e) {
      console.log(e)
    }
  }

  deleteMediaShare(userUUID, shareUUID, callback) {
    if(!isUUID(userUUID))
      return process.nextTick(callback(EInvalid('invalid userUUID')))
    if(!isUUID(shareUUID))
      return process.nextTick(callback(EInvalid('invalid shareUUID')))

    try {
      let share = this.shareMap.get(shareUUID)
      if(!share) {
        let error = Object.assign((new Error('share non-exist')), {code: 'ENOENT'})
        return process.nextTick(callback(error))
      }

      if(share.doc.author !== userUUID) {
        let error = Object.assign((new Error('no permission')), {code: 'EACCESS'})
        return process.nextTick(callback(error))
      }

      if(share.lock) {
        let error = Object.assign((new Error('busy')), {code: 'EBUSY'})
        return process.nextTick(callback(error))
      }

      this.shareStore.archive(shareUUID, err => {
        if(err) return callback(err)
        this.unIndexShare(share)
        callback(null)
      })
    } catch(e) {
      console.log(e)
    }
  }

}

export default (shareStore) => {
  let mediaShare = new MediaShare(shareStore)
  mediaShare.load()
  return mediaShare
}




