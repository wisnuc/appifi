import UUID from 'node-uuid'
import{isUUID, isSHA256, addUUIDArray, complement, assert, validateProps} from '../lib/types'

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

const validateFileShareDoc = (doc, users) => {}

const createFileShareDoc = (authorUUID, fileData, obj) => {
  let {writelist, readlist, collection} = obj

  writelist = Array.from(new Set(writelist)).filter(writer => writer !== authorUUID)

  readlist = Array.from(new Set(readlist)).filter(reader => reader !== authorUUID)
  readlist = complement(readlist, writelist)

  collection = Array.from(new Set(collection))
  // remove the uuid whose ancestor uuid is already in colleciton
  let func = node => {
    if(node.parent) 
      return collection.find(uuid => node.parent.uuid === uuid)
  }
  collection = collection.filter(uuid => !fileData.uuidMap.get(uuid).upFind(func))

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

const updateFileShareDoc = (userUUID, shareUUID, patch) => {

}

export {
  validateFileShareDoc,
  createFileShareDoc,
  updateFileShareDoc,
}










