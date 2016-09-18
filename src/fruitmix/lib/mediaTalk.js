import crypto from 'crypto'

import deepEqual from 'deep-equal'

/** 

  The structure of a mediaTalk object should be

  {
    data: {
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
    authorHash: null or Map(), author => comment hash    
    docHash: document hash
  }

  the property inside data should be structurally stable
  the comments should be sorted by time

**/

const hashObject = (obj) => {
  let hash = crypto.createHash('SHA256')
  hash.update(JSON.stringify(obj))
  return hash.digest('hex')
}

class mediaTalkPrototype {

  // assuming store has the save method, requiring owner, digest as parameters
  constructor(store) {
    this.store = store 
  }

  save(newData, callback) {
    this.store.save()    
  }

  addComment(author, text, callback) {

    // prevent racing
    let data = this.data

    // immutable, order is important, order is irrelevent to timestamp
    let newData = {
      owner: data.owner,
      digest: data.digest,
      comments: [...data.comments, {
        author, text, time: newDate().getTime()
      }]
    }

    Object.freeze(newData)

    this.save(newData, (err, docHash) => {

      if (err) return callback(err)
      if (data !== this.data) {
        let error = new Error('mediaTalk failed to save due to race condition')
        error.code = 'EBUSY'
        return callback(error)
      }

      this.docHash = docHash
      this.data = newData
      this.updateAuthorHash()

      callback(null, newData)
    })
  }

  deleteComment(author, time, callback) {

    // prevent racing
    let data = this.data

    // check existence
    let index = data.comments.find(c => c.author === author && c.time === time)
    if (index === -1) {
      return process.nextTick(() => callback(data))
    }

    let newData = {
      owner: data.owner,
      digest: data.digest,
      comments: [...data.comments.splice(0, index), ...data.comments.splice(index + 1)]
    }

    Object.freeze(newData)

    this.save(newData, (err, docHash) => {
      
      if (err) return callback(err)
      if (data !== this.data) {
        let error = new Error('mediaTalk failed to save due to race condition')
        error.code = 'EBUSY'
        return callback(error)
      }
    
      this.docHash = docHash
      this.data = newData
      this.updateAuthorHash()

      callback(null, newData)
    })
  }

  // generate a new Map from scratch
  updateAuthorHash() {

    let authorHash = new Map()
    let comments = this.data.comments

    // create a new set
    let authorSet = new Set()
    // put all authors into set
    comments.forEach(cmt => authorSet.add(cmt.author))

    if (authorSet.size) {
      // construct author array from set
      let authors = Array.from(authorSet).sort()
      // for each author, store author => hash in map
      authors.forEach(author => 
        authorHashMap.set(author, hashObject(comments.filter(cmt => cmt.author === author))))
    }

    this.authorHash = authorHash
  }


  authorsDigest(authors) {

    let filtered = authors.filter(author => this.authorHashMap.has(author)) 
    if (!filtered.length) return null

    let buffers = filtered.map(author => Buffer.from(this.authorHashMap.get(author), 'hex'))
    for (let i = 0; i < 32; i++) 
      for (let j = 1; j < buffers.length; j++) 
        buffers[0][i] ^= buffers[j][i]

    return buffers[0].toString('hex') 
  }

  authorsTalk(authors) {

    let filtered = authors.filter(author => this.authorHashMap.has(author))

    return {
      owner: this.owner,
      digest: this.digest,
      comments: this.comments.filter(cmt => filtered.find(cmt.author))
                  .sort((a, b) => a.time - b.time)
    }
  }
  
  getTalk() {

    return {
      owner: this.owner,
      digest: this.digest,
      comments: this.comments.sort((a, b) => a.time - b.time)
    }
  }
}

// this function create a blank talk, which has not been saved before, then 
// there is neither document hash nor comments
const createMediaTalk = (prototype, owner, digest) => 
  Object.create(prototype, {
    owner, digest, comments: [], authorHash: new Map()
  })

const createMediaTalkFromObject = (prototype, obj, hash) => 
  Object.create(prototype, obj)
    .updateAuthorHash()

export { createMediaTalkPrototype, createMediaTalk, createMediaTalkFromObject } 
