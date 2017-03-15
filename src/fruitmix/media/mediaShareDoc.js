import UUID from 'node-uuid'
import{addUUIDArray, subtractUUIDArray} from '../lib/types'

/**

  This file is media doc factory (no class)

  All format checking goes here. But some times its permissive.
  User permission checking is not included here.

  all functions are synchronous, no i/o operation involved.
  should throw FormatError

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
**/

// generate a mediashare doc
const createMediaShareDoc = (authorUUID, obj) => {

  let {maintainers, viewers, album, sticky, contents} = obj

  let time = new Date().getTime()

  contents = contents.map(digest => ({
    creator: authorUUID,
    digest,
    ctime: time
  }))

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

    op = ops.find(op => (op.path === 'maintainers' && op.operation === 'add'))
    if(op) {
      maintainers = addUUIDArray(maintainers, op.value)

      op.value.forEach(uuid => {
        let index = viewers.indexOf(uuid)
        if(index !== -1) viewers.splice(index, 1)
      })
    }

    op = ops.find(op => op.path === 'maintainers' && op.operation === 'delete')
    if(op) {// && Array.isArray(op.value)) {
      maintainers = subtractUUIDArray(maintainers, op.value)

      // the contents shared by deleted maintainers should also be removed
      let deletedUser = subtractUUIDArray(doc.maintainers, maintainers)
      deletedUser.forEach(uuid => {
        let index = contents.findIndex(item => item.creator === uuid)
        if(index !== -1) contents.splice(index, 1)
      })
    }

    op = ops.find(op => op.path === 'viewers' && op.operation === 'add')
    if(op) {// && Array.isArray(op.value))
      viewers = addUUIDArray(viewers, op.value)
      viewers = subtractUUIDArray(viewers, maintainers) //dedupe
    }

    op = ops.find(op => op.path === 'viewers' && op.operation === 'delete')
    if(op) // && Array.isArray(op.value))
      viewers = subtractUUIDArray(viewers, op.value)

    op = ops.find(op => op.path === 'album' && op.operation === 'update')
    if(op) {// && typeof op.value === 'object'){
      if(op.value === null) 
        album = null
      else{
        let title = op.value.title
        let text = op.value.text

        if(title === '' && text === '') 
          album = null
        else
          album = {title, text}
      }
    }

    op = ops.find(op => op.path === 'sticky' && op.operation === 'update')
    if(op && op.value !== sticky)
      sticky = op.value
  }

  if(userUUID === doc.author || doc.maintainers.indexOf(userUUID) !== -1) {

    op = ops.find(op => op.path === 'contents' && op.operation === 'add')
    if(op) {
      let c = [...contents]
      let dirty = false

      op.value.forEach(digest => {
          let index = c.findIndex(x => x.digest === digest)
          if(index !== -1) return

          dirty = true
          c.push({
            creator: userUUID,
            digest,
            ctime: new Date().getTime()
          })
        })

      if(dirty) contents = c
    }

    op = ops.find(op => op.path === 'contents' && op.operation === 'delete')
    if(op) {
      let c = [...contents]
      let dirty = false

      op.value.forEach(digest => {
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

export { createMediaShareDoc, updateMediaShareDoc }

