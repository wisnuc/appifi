import fs from 'fs'
import Promise from 'bluebird'
console.log('xstat import fs-xattr')
const xattr = require('fs-xattr')
import UUID from 'node-uuid'
import validator from 'validator'
import shallowequal from 'shallowequal'

/**
  uuid:
  owner:
  writelist:
  readlist:
  hash:
  magic:
  htime:
**/

// constant
const FRUITMIX = 'user.fruitmix'

const parseJSON = (string) => {
  try { return JSON.parse(string) } 
  catch (e) { return null }
}

const EInvalid = (text) => 
  Object.assign((new Error(text || 'invalid args')), { code: 'EINVAL' })

const InstanceMismatch = (text) => 
  Object.assign((new Error(text || 'instance mismatch')), { code: 'EINSTANCEMISMATCH' })

const TimestampMismatch = (text) =>
  Object.assign((new Error(text || 'timestamp mismatch')), { code: 'ETIMESTAMPMISMATCH' })

const readTimeStamp = (target, callback) =>
  fs.stat(target, (err, stats) => 
    err ? callback(err) : callback(null, stats.mtime.getTime()))

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

const validateOwner = (owner) => {
  let val = validateUserList(owner)
  if (val === undefined) return []
  return val
}

// validate hash
// const isHashValid = (hash, htime, mtime) => htime === mtime && /[a-f0-9]{64}/.test(hash)
const isHashValid = (hash) => /[a-f0-9]{64}/.test(hash)

// validate Xattr
const validateXattr = (attr, type, mtime) => {

  attr.uuid = validateUUID(attr.uuid)
  // attr.owner = validateUserList(attr.owner)
  attr.owner = validateOwner(attr.owner)
  attr.writelist = validateUserList(attr.writelist)
  attr.readlist = validateUserList(attr.readlist)

  if (!attr.writelist && attr.readlist) attr.writelist = []
  if (!attr.readlist && attr.writelist) attr.readlist = []

  switch(type) {
  case 'file':
    if (!Number.isInteger(mtime)) throw new Error('mtime must be an integer')
    if (attr.hasOwnProperty('hash') || attr.hasOwnProperty('htime')) {
      if (!isHashValid(attr.hash) || attr.htime !== mtime) {
        if (attr.hasOwnProperty('hash')) delete attr.hash
        if (attr.hasOwnProperty('magic')) delete attr.magic // TODO workaround solution 
        if (attr.hasOwnProperty('htime')) delete attr.htime
      }
    }
    break

  case 'folder':
    if (attr.hasOwnProperty('hash')) delete attr.hash
    if (attr.hasOwnProperty('htime')) delete attr.htime
    break

  default:
    throw new Error('invalid type')
  }
  return attr
}

// opts determines if there is no xattr or xattr is not valid JSON
//
//    null: function returns null, xattr won't be set
//    object: this object will be used as xattr, it's owner, writelist, readlist must all be uuid array (empty is fine)
//    not provided: using default
//
// const readXstat = (target, opts, callback) => 
// const readXstat = (target, callback) => 
// well - formatted

const readXstat = (target, ...args) => {

  let opts = args.length === 2 ? args.shift() : undefined
  let callback = args.shift() 

  if (opts !== undefined && typeof opts !== 'object')
    return process.nextTick(callback, new TypeError('opts invalid'))

  // now opts is either null or object
  if (opts) { // not null
    if  (
          opts.owner && opts.owner === validateUserList(opts.owner) &&
          (
            (opts.writelist && opts.writelist === validateUserList(opts.writelist) && opts.readlist && opts.readlist === validateUserList(opts.readlist))
              ||
            (opts.writelist === undefined && opts.readlist === undefined)
          )
        )
    { }
    else
      return process.nextTick(callback, new TypeError('opts invalid'))
  }

  let parsed, valid
  fs.stat(target, (err, stats) => {

    if (err) return callback(err)
    if (!(stats.isDirectory() || stats.isFile())) return callback(new Error('not a folder or file'))
    if (!stats.isDirectory() && opts && (opts.writelist || opts.readlist)) return callback(new Error('not a folder (opts)'))

    xattr.get(target, FRUITMIX, (err, attr) => {

      if (err && err.code !== 'ENODATA') return callback(err)
      if (!err) parsed = parseJSON(attr)
      if (err || !parsed) { // ENODATA or JSON invalid

        if (opts === null) return callback(null, null)
        if (opts === undefined) opts = { uuid: UUID.v4(), owner: [] }
        else opts.uuid = UUID.v4()

        return xattr.set(target, FRUITMIX, JSON.stringify(opts), err => 
          err ? callback(err) : callback(null, Object.assign(stats, opts, { abspath: target })))
      }

      let type, copy = Object.assign({}, parsed)
      if (stats.isDirectory()) type = 'folder'
      else if (stats.isFile()) type = 'file'
      else throw new Error('unexpected type')

      valid = validateXattr(parsed, type, stats.mtime.getTime())
      if (!shallowequal(valid, copy)) 
        xattr.set(target, FRUITMIX, JSON.stringify(valid), err => 
          err ? callback(err) : callback(null, Object.assign(stats, valid, { abspath: target }))) 
      else 
        callback(null, Object.assign(stats, valid, { abspath: target }))
    }) // xattr.get
  })
}

const updateXattrOwner = (target, uuid, owner, callback) => {

  readXstat(target, (err, xstat) => {
    if (err) return callback(err)
    if (xstat.uuid !== uuid) return callback(InstanceMismatch())
    let { writelist, readlist, hash, htime } = xstat 
    let newAttr = { uuid, owner, writelist, readlist, hash, htime }
    xattr.set(target, FRUITMIX, JSON.stringify(newAttr), err => 
      err ? callback(err) : callback(null, Object.assign(xstat, { owner })))
  })
}

const updateXattrPermission = (target, uuid, writelist, readlist, callback) => {

  readXstat(target, (err, xstat) => {
    if (err) return callback(err)
    if (xstat.uuid !== uuid) return callback(InstanceMismatch()) 
    let { owner, hash, magic, htime } = xstat
    let newAttr = { uuid, owner, writelist, readlist, hash, magic, htime }
    xattr.set(target, FRUITMIX, JSON.stringify(newAttr), err => 
      err ? callback(err) : callback(null, Object.assign(xstat, { writelist, readlist })))
  })
}

const updateXattrHash = (target, uuid, hash, htime, callback) => {

  readXstat(target, (err, xstat) => {
    if (err) return callback(err)
    if (xstat.uuid !== uuid) return callback(InstanceMismatch())
    let { owner, writelist, readlist } = xstat
    let newAttr = { uuid, owner, writelist, readlist, hash, htime }
    xattr.set(target, FRUITMIX, JSON.stringify(newAttr), err => 
      err ? callback(err) : callback(null, Object.assign(xstat, { hash, htime })))
  })
}

const updateXattrHashMagic = (target, uuid, hash, magic, htime, callback) => {
  
  readXstat(target, (err, xstat) => {
    if (err) return callback(err)

    // uuid mismatch
    if (xstat.uuid !== uuid) return callback(InstanceMismatch())
    // invalid hash or magic
    if (!isHashValid(hash) || typeof magic !== 'string' || magic.length === 0) return callback(EInvalid())
    // timestamp mismatch
    if (xstat.mtime.getTime() !== htime) return callback(TimestampMismatch())

    let { owner, writelist, readlist } = xstat
    let newXattr = { uuid: xstat.uuid, owner, writelist, readlist, hash, magic, htime }
    xattr.set(target, FRUITMIX, JSON.stringify(newXattr), err => {
      err ? callback(err) : callback(null, Object.assign(xstat, { hash, magic, htime, abspath:target }))
    })
  })
}

const copyXattr = (dst, src, callback) => {

  xattr.get(src, 'user.fruitmix', (err, attr) => {

    // src has not xattr, nothing to copy
    if (err && err.code === 'ENODATA') return callback(null)
    if (err) return callback(err)

    xattr.set(dst, 'user.fruitmix', attr, err => 
      err ? callback(err) : callback(null))
  })
}

const readXstatAsync = Promise.promisify(readXstat)
const copyXattrAsync = Promise.promisify(copyXattr)

const testing = {}

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









