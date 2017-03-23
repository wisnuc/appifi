import UUID from 'node-uuid'
import{isUUID, addUUIDArray, complement, assert, validateProps} from '../lib/types'

/**
 * a fileshare doc
 *
 * {
 *   doctype: 'fileshare',        // string, fixed
 *   docversion: '1.0',           // string, fixed
 *   
 *   uuid: xxxx,                  // STRING_UUID 
 *   
 *   author: xxxx,                // STRING_UUID 
 *   writelist: [], // 0..n       // ARRAY_STRING_UUID
 *   readlist: [], // 0..n        // ARRAY_STRING_UUID
 *
 *   ctime: xxxx,                 // INT_TIME
 *   mtime: xxxx,                 // INT_TIME
 *   
 *   collection: [], // 1..n      // ARRAY_STRING_UUID
 * }
 */
const unique = arr => new Set(arr).size === arr.length

const isUUIDArray = (arg) => Array.isArray(arg) && arg.every(isUUID)

const validateFileShareDoc = (doc, users) => {
  let localUsers = users.filter(u => u.type === 'local')
  let members = [doc.author, ...doc.writelist, ...doc.readlist]
  // structure
  validateProps(doc, [
    'doctype', 'docversion',
    'uuid', 'author', 'writelist', 'readlist',
    'ctime', 'mtime',
    'collection'
  ])
  // data type
  assert(doc.doctype === 'fileshare', 'invalid doctype')
  assert(doc.docversion === '1.0', 'invalid docversion')
  assert(isUUID(doc.uuid), 'invalid doc uuid')
  assert(isUUID(doc.author), 'invalid author uuid')

  // if author is not local user, the share is considered invalid
  assert(localUsers.map(u => u.uuid).includes(doc.author), 'author not found in local users')

  // writer or reader must be local user
  assert(isUUIDArray(doc.writelist), 'writelist not uuid array')
  assert(doc.writelist.every(uuid => localUsers.map(u => u.uuid).includes(uuid)),
    'writelist contains non-local users')  // TODO if local user is deleted ?
  assert(isUUIDArray(doc.readlist), 'readlist not uuid array')
  assert(doc.readlist.every(uuid => localUsers.map(u => u.uuid).includes(uuid)),
    'readlist contains non-local users')  // TODO if local user is deleted ?

  // no member in list twice
  assert(unique(members), 'members not unique')

  assert(Number.isInteger(doc.ctime), 'invalid ctime')
  assert(Number.isInteger(doc.mtime), 'invalid mtime')

  assert(isUUIDArray(doc.collection), 'collection not uuid array')
}

const createFileShareDoc = (fileData, authorUUID, obj) => {
  let {writelist, readlist, collection} = obj

  writelist = Array.from(new Set(writelist)).filter(writer => writer !== authorUUID)

  readlist = Array.from(new Set(readlist)).filter(reader => reader !== authorUUID)
  readlist = complement(readlist, writelist)

  collection = Array.from(new Set(collection))
  // remove the uuid whose ancestor uuid is already in collection
  let lookup = node => {
    if(node.parent) 
      return collection.find(uuid => node.parent.uuid === uuid)
  }
  collection = collection.filter(uuid => !fileData.uuidMap.get(uuid).upFind(lookup))

  let time = new Date().getTime()
  return {
    doctype: 'fileshare',
    docversion: '1.0',
    uuid: UUID.v4(),
    author: authorUUID,
    writelist,
    readlist,
    ctime: time,
    mtime: time,
    collection
  }             
}

const updateFileShareDoc = (fileData, doc, ops) => {
  let op
  let {writelist, readlist, collection} = doc

  let lookup = node => {
    if(node.parent) 
      return collection.find(uuid => node.parent.uuid === uuid)
  }

  op = ops.find(op => (op.path === 'writelist' && op.operation === 'add'))
  if(op) {
    writelist = addUUIDArray(writelist, op.value)
    // delete the reader which is moved to writelist
    readlist = complement(readlist, op.value)
  }

  op = ops.find(op => op.path === 'writelist' && op.operation === 'delete')
  if(op) writelist = complement(writelist, op.value)

  op = ops.find(op => op.path === 'readlist' && op.operation === 'add')
  if(op) {// && Array.isArray(op.value))
    readlist = addUUIDArray(readlist, op.value)
    readlist = complement(readlist, writelist) //dedupe
  }

  op = ops.find(op => op.path === 'readlist' && op.operation === 'delete')
  if(op) readlist = complement(readlist, op.value)

  op = ops.find(op => op.path === 'collection' && op.operation === 'add')
  if(op) {
    collection = addUUIDArray(collection, op.value)
    collection = collection.filter(uuid => !fileData.uuidMap.get(uuid).upFind(lookup))
  }

  op = ops.find(op => op.path === 'collection' && op.operation === 'delete')
  if(op) collection = complement(collection, op.value)

  if (writelist === doc.writelist &&
      readlist === doc.readlist &&
      collection === doc.collection){
    return doc
  }
  
  let update = {
    doctype: doc.doctype,
    docversion: doc.docversion,
    uuid: doc.uuid,
    author: doc.author,
    writelist,
    readlist,
    ctime: doc.ctime,
    mtime: new Date().getTime(),
    collection
  }

  return update
}

export {
  validateFileShareDoc,
  createFileShareDoc,
  updateFileShareDoc,
}










