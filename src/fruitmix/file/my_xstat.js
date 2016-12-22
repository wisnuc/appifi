import fs from 'fs'
import chlid from 'child_process'
import xattr from 'fs-xattr'
import UUID from 'node-uuid'
import validator from 'validator'
import shallowequal from 'shallowequal'

Promise.promisifyAll('xattr')

// constant
const FRUITMIX = 'user.fruitmix'
const UNINTERESTED_MAGIC_VERSION = 0

const parseJSON = (string) => {
  try { return JSON.parse(string) } 
  catch (e) { return null }
}

const EInvalid = (text) => 
  Object.assign((new Error(text || 'invalid args')), { code: 'EINVAL' })

const InstanceMismatch = (text) => 
  Object.assign((new Error(text || 'instance mismatch')), { code: 'EMISMATCH' })

const TimestampMismatch = (text) =>
  Object.assign((new Error(text || 'timestamp mismatch')), { code: 'EOUTDATED' })

// const readTimeStamp = (target, callback) =>
//   fs.lstat(target, (err, stats) => 
//     err ? callback(err) : callback(null, stats.mtime.getTime()))

// test uuid, return true or false, accept undefined
const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false

// validate uuid, if invalid, return new
const validateUUID = (uuid) => isUUID(uuid) ? uuid : UUID.v4()

// validate uuid array, if array, filter out invalid, if not array, return undefined
// this function returns original if valid, for shallowequal comparison
const validateUserList = (list) => {
  if (!Array.isArray(list)) return undefined // undefined
  return list.every(isUUID) ? list : list.filter(isUUID)
}

// validate hash
const isSHA256 = (hash) => /[a-f0-9]{64}/.test(hash)

// validate magic
const parseMagic = text => text.startWith('JPEG image data') ? 'JPEG' : UNINTERESTED_MAGIC_VERSION

//get magic of file
const fileMagic = (target, callback) => {
  child.exec(`file -b ${target}`, (err, stdout, stderr) => {
    err ? callback(err) : callback(parseMagic(stdout.toString()))
  })
}

// throw SyntaxError if given attr is bad formatted
const validateOldFormat = (attr, isFile) => {

  if(typeof attr.uuid !== 'string' || !isUUID(attr.uuid)) 
    throw new SyntaxError('invalid uuid')

  if(Array.isArray(attr.owner) && attr.owner.every(item => isUUID(item))) {}
  else throw new SyntaxError('invalid owner')

  if(attr.writelist === null || attr.writelist.every(item => isUUID(item))) {}
  else throw new SyntaxError('invalid writelist')

  if(attr.readlist === null || attr.readlist.every(item => isUUID(item))) {}
  else throw new SyntaxError('invalid readlist')

  if(!!attr.writelist && !!attr.readlist) {}
  else throw new SyntaxError('writelist and readlist inconsistent')

  if(isFiles) {
    // hash and htime both exist or both are absent
    if(attr.hasOwnProperty('hash') === attr.hasOwnProperty('htime')) {}
    else throw new SyntaxError('hash and htime inconsistent')

    if(attr.hasOwnProperty('hash')) {
      if(!isSHA256(attr.hash))
        throw new SyntaxError('invalid hash')

      if(!Number.isInteger(attr.htime))
        throw new SyntaxError('invalid htime')
    }

    if(attr.hasOwnProperty('magic')) {
      if(!typeof attr.magic === 'string') 
        throw new SyntaxError('invalid magic')
    }
  }
}

const validateNewFormat = (attr, isFile) => {
  if(typeof attr.uuid !== 'string' || !isUUID(attr.uuid)) 
    throw new SyntaxError('invalid uuid')

  if(attr.writelist && attr.writelist.every(item => isUUID(item))) {}
  else throw new SyntaxError('invalid writelist')

  if(attr.readlist && attr.readlist.every(item => isUUID(item))) {}
  else throw new SyntaxError('invalid readlist')

  if(isFile) {
    if(attr.hasOwnProperty('hash') === attr.hasOwnProperty('htime')) {}
    else throw new SyntaxError('hash and htime inconsistent')

    if(attr.hasOwnProperty('hash')) {
      if(!isSHA256(attr.hash))
        throw new SyntaxError('invalid hash')

      if(!Number.isInteger(attr.htime))
        throw new SyntaxError('invalid htime')
    }

    if(attr.hasOwnProperty('magic')) {
      if(typeof attr.magic === 'string' || Number.isInteger(attr.magic)) {} 
      else throw new SyntaxError('invalid magic')
    }
  }
}

const readXstatAsync = async target => {
  let attr, dirty, stats = await fs.lstatAsync(target)
  if(!stats.isFile() && !stats.isDirectory())
    throw Object.assign(new Error('not a directory or file'), { code: 'ENOTDIRORFILE' })

  try{
    attr = await JSON.parse(xattr.getAsync(target, FRUITMIX))

    if(attr.hasOwnProperty('owner')) {
      validateOldFormat()

      dirty = true
      delete attr.owner
      if(attr.writelist === null) delete attr.writelist
      if(attr.readlist === null) delete attr.readlist
      if(stats.isFile())
        attr.magic = attr.magic ? parseMagic(attr.magic) : fileMagic(attr.magic)
    } else
      validateNewFormat(attr)

    // drop hash if outdated
    if(stats.isFile() && attr.htime && attr.htime !== stats.mtime) {
      dirty = true
      delete attr.hash
      delete attr.htime
    }
  } catch(e) {
    if(e.code !== 'ENODATA' && !(e instanceof SyntaxError)) throw e
    dirty = true
    attr = { uuid : UUID.v4()}
    if(stats.isFile()) attr.magic = fileMagic(target)
  }
  
  // save new attr if dirty
  if(dirty) await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr))

  //remove props not passed to caller
  if(stats.isFile() && attr.htime) delete attr.htime
  if(stats.isFile() && typeof attr.magic === 'number') delete attr.magic

  return Object.assign(stats, attr, {abspath : target})
}

const readXstat = (target, callback) => readXstatAsync(target).asCallback(callback)
  

const updateXattrPermission = (targert, uuid, writelist, readlist, callback) => {
  if(!isUUID(uuid))
    return process.nextTick(() => callback(EInvalid('invalid uuid')))

  readXstat(target, (err, xstat) => {
    if(err) return callback(err)
    if(xstat.uuid !== uuid) return callback(InstanceMismatch())

    let newAttr = {uuid}
  })
}

const updateXattrHash = () => {}

const copyXattr = () => {}




export { 
  readTimeStamp,
  readXstat,
  readXstatAsync,
  updateXattrOwner,
  updateXattrPermission,
  updateXattrHash,
  updateXattrHashMagic,
  copyXattr,
  copyXattrAsync,
  testing
}

