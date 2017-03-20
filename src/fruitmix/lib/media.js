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
  }


**/

const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false
const isSHA256 = (sha256) => (typeof sha256 === 'string') ? /[a-f0-9]{64}/.test(sha256) : false

const sha1comments = (comments) => {
  let hash = crypto.createHash('sha1')
  comments.forEach(cmt => hash.update(cmt.author + cmt.datetime + cmt.text))
  return hash.digest('hex')
}

// this function generate a mediashare doc
const createMediaShareDoc = (userUUID, obj) => {

  let { maintainers, viewers, album, sticky, contents } = obj

  // FIXME
  maintainers = []

  if (!Array.isArray(viewers)) viewers = []

  // validate, sort, dedup, and must not be the user itself
  viewers = viewers
    .filter(isUUID)
    .filter(viewer => viewer !== userUUID) // remove self ?
    .sort()
    .filter((item, index, array) => !index || item !== array[index - 1])

  // album must be true or false, defaults to false
  if (!album) album = null
  else {

    //  {
    //    title: string
    //    text: string
    //  }

    let obj = {}
    if (typeof album.title === 'string')
      obj.title = album.title
    else 
      obj.title = ''

    if (typeof album.text === 'string')
      obj.text = album.text
    else
      obj.text = ''

    album = obj
  }

  // sticky must be true or false, defaults to false
  if (typeof sticky !== 'boolean') sticky = false

  if (!Array.isArray(contents)) 
    contents = []
  else {

    let time = new Date().getTime()
    contents = contents
      .filter(isSHA256)
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

/**
  each op contains:
  {
    op: 'add', 'delete', or 'update', add, delete for array, update for non-array
  }
**/

const sortDedup = (isType) => {
  return (arr) => {
    return [...arr]
      .filter(isType)
      .sort()
      .filter((item, index, arr) => !index || item !== arr[index - 1])
  }
}

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

const subtractContentArray = (userUUID, a, b) => {

  let aa = [...a]
  let dirty = false

  b.forEach(digest => {
    let index = aa.findIndex(x => x.digest === digest)
    if (index !== -1) {
      dirty = true
      aa.splice(index, 1)
    }
  })

  return dirty ? aa : a 
}

const addUUIDArray = (a, b) => {
  
  let c = sortDedup(isUUID)([...a, ...b])    
  return deepEqual(a, c) ? a : c 
}

const updateMediaShareDoc = (userUUID, doc, ops) => {

  let op
  let { maintainers, viewers, album, sticky, contents } = doc

  if (userUUID === doc.author) {

    op = ops.find(op => op.path === 'maintainers' && op.op === 'delete') 
    if (op && Array.isArray(op.value)) {
      maintainers = subtractUUIDArray(maintainers, sortDedup(isUUID)(op.value))
    }

    op = ops.find(op => op.path === 'maintainers' && op.op === 'add') 
    if (op && Array.isArray(op.value)) {
      maintainers = addUUIDArray(maintainers, sortDedup(isUUID)(op.value).filter(x => x !== doc.author))
    }

    op = ops.find(op => op.path === 'viewers' && op.op === 'delete')
    if (op && Array.isArray(op.value)) {
      viewers = subtractUUIDArray(viewers, sortDedup(isUUID)(op.value))
    }

    op = ops.find(op => op.path === 'viewers' && op.op === 'add') 
    if (op && Array.isArray(op.value)) {
      viewers = addUUIDArray(viewers, sortDedup(isUUID)(op.value).filter(x => x !== doc.author))
    }

    op = ops.find(op => op.path === 'album' && op.op === 'replace') 
    if (op && typeof op.value === 'object') {
      let title = typeof op.value.title === 'string' ? op.value.title : ''
      let text = typeof op.value.text === 'string' ? op.value.text : ''   

      if (title !== album.title || text !== album.text) album = { title, text }
    }

    op = ops.find(op => op.path === 'sticky' && op.op === 'replace')
    if (op && typeof op.value === 'boolean' && op.value !== sticky) {
      sticky = op.value
    }
  }

  if (userUUID === doc.author || doc.maintainers.indexOf(userUUID) !== -1) {

    op = ops.find(op => op.path === 'contents' && op.op === 'delete') 
    if (op && Array.isArray(op.value)) {

      let c = [...contents]
      let dirty = false

      sortDedup(isSHA256)(op.value)
        .forEach(digest => {
          let index = c.findIndex(x => 
            x.digest === digest && ( userUUID === doc.author || userUUID === x.creator)) 

          if (index !== -1) {
            c.splice(index, 1)
            dirty = true
          }
        })

      if (dirty) contents = c 
    }

    op = ops.find(op => op.path === 'contents' && op.op === 'add')
    if (op && Array.isArray(op.value)) {

      let c = [...contents]
      let dirty = false

      sortDedup(isSHA256)(op.value)
        .forEach(digest => {
          let index = c.findIndex(x => x.digest === digest)
          if (index !== -1) return

          c.push({
            digest: b,
            creator: userUUID,
            ctime: new Date().getTime() 
          })              
          dirty = true
        })

      if (dirty) contents = c 
    }
  }

  if (maintainers === doc.maintainers &&
      viewers === doc.viewers &&
      album === doc.album &&
      sticky === doc.sticky &&
      contents === doc.contents) {

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

const userViewable = (share, userUUID) => 
  (share.doc.author === userUUID ||
    share.doc.maintainers.indexOf(userUUID) !== -1 ||
    share.doc.viewers.indexOf(userUUID) !== -1)


/** 

  The structure of a mediaTalk object should be

  {
    doc: {
      owner: <UUID, string>,
      digest: <SHA256, string>,
      comments: [ // sorted by time
        {
          author: <UUID, string>,
          time: <Integer, number>,
          text: <String>
        },
        ...
      ]
    },
    commentHashMap: null or Map(), author => comment hash    
    digest: document hash
  }

  the property inside doc should be structurally stable (canonicalized)
  the comments should be sorted in creation order (not strictly by time, if time is wrong)

**/



/*****************************************************************************

  shareMap is something like uuid map in forest

    share.doc.uuid => share

  mediaMap is like the digeset => digestObj map in forest, instead of array 
  for nodes, it uses JavaScript Set as collection object for shares

    for each item in a share's contents array

    item.digest => shareSet, which is collections of share  

 *****************************************************************************/
class Media extends EventEmitter {

  // shareMap stores uuid (key) => share (value)
  // mediaMap stores media/content digest (key) => (containing) share Set (value), each containing share Set contains share
  constructor(shareStore, talkStore) {

    super()

    this.shareStore = shareStore
    this.talkStore = talkStore

    // using an map instead of an array
    this.shareMap = new Map()
    // using an map instead of an array
    this.mediaMap = new Map()

    // each (local) talk has its creator and media digest, as its unique identifier
    this.talks = []

    // 
    // suspicious
    //
    // each remote talk has its viewer (a local user), creator, and media digest, as its unique identifier
    this.remoteMap = new Map()      // user -> user's remote talks
                                    // each talk has creator and media digest as its unique identifier

    // when user V retrieve talks
    // traverse all talks 
    // supposing talk has owner U and digest D
    //   traversing shareSet from mediaMap D => shareSet
    //   if a share author = U, with V as viewable, then add all viewers for this set to SET
    //   this new SET(U, D) containers all authors whose comments can be viewed by V.
    // then XOR hash of user belong to such set 

    // then should we differentiate local and remote users? I think not.
 
  }

  getTalks(userUUID) {

    const SHA1 = (comments) => {

      let hash = crypto.createHash('sha1')

      filtered.forEach(cmt => {
        hash.update(cmt.author)
        hash.update(cmt.datetime)
        hash.update(cmt.text)
      })

      return hash.digest('hex')
    }

    let arr = []
    this.talks.forEach(talk => {

      let { owner, digest } = talk.doc 
      if (owner === userUUID) {
        arr.push({ owner, digest, comments: talk.doc.comments, sha1: SHA1(talk.doc.comments) })
      }
      else {

        let shareSet = this.mediaMap.get(digest)      
        if (!shareSet) return     

        // fellows (mutual, reciprocal.... see thesaurus.com for more approriate words)
        let fellows = new Set()
        shareSet.forEach(share => {
          if (owner === share.doc.author && userViewable(share, userUUID)) {
            fellows.add(share.doc.author)
            share.doc.maintainers.forEach(u => fellows.add(u))
            share.doc.viewers.forEach(u => fellows.add(u))
          }
        })

        // the talk owner did not share anything with you, otherwise, at least himself and you will
        // be in fellows
        if (fellows.size === 0) return

        let comments = talk.doc.comments.filter(cmt => fellows.has(cmt.author))
        let sha1 = SHA1(comments) 
        arr.push({ owner, digest, comments: comments, sha1 })
      }
       
    })

    return arr
  }

  load() {

    this.shareStore.retrieveAll((err, shares) => {
      shares.forEach(share => {
        this.indexShare(share)
      })
      this.emit('shareStoreLoaded')
    }) 

    this.talkStore.retrieveAll((err, talks) => {
      talks.forEach(talk => {
        this.indexTalk(talk)
      })
    })
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
      callback(null, share)
    })
  } catch (e) {
    console.log(e)
  }
  }

  // FIXME permission check
  updateMediaShare(userUUID, shareUUID, ops, callback) {
  try {

    let share = this.shareMap.get(shareUUID)
    if (!share) return callback('ENOENT') // FIXME

    if (share.doc.author !== userUUID)
      return callback('EACCESS')

    let doc = updateMediaShareDoc(userUUID, share.doc, ops) 
    if (doc === share.doc) 
      return callback(null, share)

    this.shareStore.store(doc, (err, newShare) => {
      if (err) return callback(err)
      this.unindexShare(share) 
      this.indexShare(newShare)
      callback(null, newShare)
    })
     
  } catch (e) {
    console.log(e)
  }
  }

  // archive a mediashare and unindex
  // FIXME permission check
  deleteMediaShare(userUUID, shareUUID, callback) {

    let share = this.shareMap.get(shareUUID)
    if (!share) return callback('ENOENT')

    this.shareStore.archive(shareUUID, err => {
      if (err) return callback(err)
      this.unindexShare(share)
      this.shareMap.delete(shareUUID) 
      callback(null)
    })
  }

  // my share is the one I myself is the creator
  // locally shared with me is the one that I am the viewer but not creator, the creator is a local user
  // remotely shared with me is the one that I am the viewer but not creator, the creator is a remote user
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

  fillMediaMetaMap(mediaMap, userUUID, filer) {

    this.mediaMap.forEach((shareSet, digest) => {

      let digestObj = filer.hashMap.get(digest)
      if (!digestObj) return
      
      let shareArr = Array.from(shareSet)
     
      // sharedWithOthers if author === userUUID && readable(userUUID), sharedWithOthers 
      // sharedWithMe if author !== userUUID && userUUID viewable && readable(
      let viewable = false
      let swo = false
      let swm = false

      for (let i = 0; i < shareArr.length; i++) {

        if (viewable && swo && swm) 
          break

        if (userViewable(shareArr[i], userUUID))
          viewable = true
        else
          continue

        let contents = shareArr[i].doc.contents
        
        if (!swo && mediaMap.has(digest)) {
          if (contents.find(c => c.digest === digest && c.creator === userUUID)) swo = true
        }

        if (!swm) {
          if (contents.find(c => c.digest === digest && c.creator !== userUUID && filer.mediaUserReadable(digest, c.creator))) 
            swm = true
        }
      }

      if (viewable) {
        let obj = mediaMap.get(digest)    
        if (obj) {
          obj.sharing = 1 | (swo ? 2 : 0) | (swm ? 4 : 0)
        }
        else {
          obj = { digest, type: digestObj.type, meta: digestObj.meta }
          obj.sharing = swm ? 4 : 0
          mediaMap.set(digest, obj)
        }
      }
    })
  }

  /////////////////////////////////////////////////////////////////////////////

  fellowSet(userUUID, owner, digest) {

    let fellows = new Set()
    
    let shareSet = this.mediaMap.get(digest)
    if (!shareSet) return fellows

    shareSet.forEach(share => {
      if (owner === share.doc.author && userViewable(share, userUUID)) {
        fellows.add(share.doc.author)
        share.doc.maintainers.forEach(u => follows.add(u))
        share.doc.viewers.forEach(u => fellows.add(u))
      }
    }) 

    return fellows
  }

  retrieveTalk(userUUID, owner, digest) {
  
    let talk = this.talks.find(t => 
      t.doc.owner === owner && t.doc.digest === digest)

    if (!talk) return

    let fellows = this.fellowSet(userUUID, owner, digest)

    if (userUUID === owner) fellows.add(userUUID)

    let comments = talk.doc.comments.filter(cmt => fellows.has(cmt.author))
    let sha1 = sha1comments(comments)
    return { owner, digest, comments, sha1 }
  }

  addComment(userUUID, owner, digest, text, callback) {

    // first, there exists a photo with given digest for owner (no it is bypassed) TODO
    // second, there exists a share that AUTHORIZE userUUID to comment on such photo

    let talk

    if (userUUID === owner)  {
    }
    else {
      let shareSet = this.mediaMap.get(digest)
      if (!shareSet) return callback(new Error('not found'))


      let allowed = Array.from(shareSet).find(share => {
        return share.doc.author === owner || userViewable(share, userUUID)
      })

      if (!allowed) return callback(new Error('not permitted')) 

      talk = this.talks.find(talk => 
        talk.doc.owner === owner && talk.doc.digest === digest)
    }

    let doc
    if (talk) {
      // found 
      doc = {
        owner: doc.owner,
        digest: doc.digest,
        comments: [...doc.comments, {
          author: userUUID,
          datetime: new Date().toJSON(),
          text 
        }]
      }

      this.talkStore.store(doc, (err, dgdoc) => {
        if (err) return callback(err)
        talk.digest = dgdoc.digest
        talk.doc = dgdoc.doc
        callback(null, this.retrieveTalk(userUUID, owner, digeset))
      })
    }
    else {
     
      doc = {
        owner,
        digest,
        comments: [{
          author: userUUID,
          datetime: new Date().toJSON(),
          text
        }] 
      } 

      this.talkStore.store(doc, (err, newtalk) => {
        if (err) return callback(err)
        this.talks.push(newtalk)
        callback(null, this.retrieveTalk(userUUID, owner, digest))
      })
    }
  }
}

export default (shareStore, talkStore) => {
  let media = new Media(shareStore, talkStore)
  media.load()
  return media
}

