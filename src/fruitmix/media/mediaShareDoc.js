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

  // validate, dedupe, and mustn't be the author itself
  if(!Array.isArray(maintainers)) maintainers = []

  maintainers = dedupe(isUUID)(maintainers).filter(maintainer => maintainer !== authorUUID) // remove author itself

  // validate, dedupe, and mustn't be the author itself
  if(!Array.isArray(viewers)) viewers = []

  viewers = dedupe(isUUID)(viewers).filter(viewer => viewer !== authorUUID) // remove author itself
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
    contents = dedupe(isSHA256)(contents)
      .map(digest => ({
        creator: authorUUID,
        digest,
        ctime: time
      }))
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

    op = ops.find(op => (op.path === 'maintainers' && op.operation === 'add'))
    if(op && Array.isArray(op.value))
      maintainers = addUUIDArray(maintainers, dedupe(isUUID)(op.value).filter(i => i !== doc.author))

    op = ops.find(op => op.path === 'maintainers' && op.operation === 'delete')
    if(op && Array.isArray(op.value)) {
      maintainers = subtractUUIDArray(maintainers, dedupe(isUUID)(op.value))

      // the contents shared by deleted maintainers should also be removed
      let deletedUser = subtractUUIDArray(doc.maintainers, maintainers)
      deletedUser.forEach(uuid => {
        let index = contents.findIndex(item => item.creator === uuid)
        if(index !== -1) contents.splice(index, 1)
      })
    }

    op = ops.find(op => op.path === 'viewers' && op.operation === 'add')
    if(op && Array.isArray(op.value))
      viewers = addUUIDArray(viewers, dedupe(isUUID)(op.value).filter(i => i !== doc.author))
      viewers = subtractUUIDArray(viewers, maintainers) //dedupe

    op = ops.find(op => op.path === 'viewers' && op.operation === 'delete')
    if(op && Array.isArray(op.value))
      viewers = subtractUUIDArray(viewers, dedupe(isUUID)(op.value))

    op = ops.find(op => op.path === 'album' && op.operation === 'update')
    if(op && typeof op.value === 'object'){
      let title = typeof op.value.title === 'string' ? op.value.title : (!!album ? album.title : '')
      let text = typeof op.value.text === 'string' ? op.value.text : (!!album ? album.text : '')

      if(title === '' && text === '') 
        album = null
      else 
        album = {title, text}
    }

    op = ops.find(op => op.path === 'sticky' && op.operation === 'update')
    if(op && typeof op.value === 'boolean' && op.value !== sticky)
      sticky = op.value
  }

  if(userUUID === doc.author || doc.maintainers.indexOf(userUUID) !== -1) {

    op = ops.find(op => op.path === 'contents' && op.operation === 'add')
    if(op && Array.isArray(op.value)) {
      let c = [...contents]
      let dirty = false

      dedupe(isSHA256)(op.value)
        .forEach(digest => {
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
    if(op && Array.isArray(op.value)) {
      let c = [...contents]
      let dirty = false

      dedupe(isSHA256)(op.value)
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

export { createMediaShareDoc, updateMediaShareDoc }

