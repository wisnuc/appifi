/*
 *  Copyright 2017 Shanghai Wisnuc Incorporated. All rights reserved.
 *
 *  This file is part of Wisnuc Fruitmix software.
 *
 *  Wisnuc Fruitmix is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Wisnuc Fruitmix is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Wisnuc Fruitmix.  If not, see <http://www.gnu.org/licenses/>.
 */
const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')

// const mmm = require('mmmagic')
const xattr = Promise.promisifyAll(require('fs-xattr'))
const UUID = require('uuid')
const validator = require('validator')

const filetype = require('./file-type')

const Magic = require('./magic') 
const E = require('./error')

const { isUUID, isSHA256 } = require('./assertion')


/** 
### Overview

#### xattr

Fruitmix uses **extended attributes** (xattr) to store information for regular 
files and directories.

xattr stores information as key value pair. 

Fruitmix use `user.fruitmix` as key, where `user` is namespace and a dot must be used as separator.

An object is stored as json string in xattr value.

The object has a uuid for both files and directories.

+ uuid: a uuid string

For files, the object has extra properties:

+ hash: file hash in hex string (sha256)
+ time: timestamp in number (mtime.getTime()), used to detect outdated hash
+ magic: string | version number

magic is mandatory. hash and time is optional, but they must exist together.

magic is either a string representing a file type, or a number representing a version.

For example, in version 0, only 'JPEG' file type is supported. If a file is a JPEG file, the magic string is set to 'JPEG', and if it is a PNG file, it is set to 0.

When PNG is supported in version 1. An old file with magic set to 0 will be re-examined. If it is a PNG file, the magic will be set to 'PNG'. If not, the magic is set to 1 to prevent it from being examined again. The JPEG file will not be influenced.

#### xstat

`xstat` is an mixin object from file path, `fs.stats`, and xattr object.

```javascript
xstat (dir) {
  uuid: 'uuid string',
  type: 'directory',
  name: 'directory name',
  mtime: stats.mtime.getTime()
}

xstat (file) {
  uuid: 'uuid string',
  type: 'file',
  name: 'file name',
  mtime: stats.mtime.getTime(),
  size: stats.size,
  magic: 'string or number',
  hash: 'file hash, optional'
}
```

@module xstat 
*/

/** @constant {string} FRUITMIX - `user.fruitmix`, xattr key **/
const FRUITMIX = 'user.fruitmix'


/** @func isNonNullObject **/
const isNonNullObject = obj => typeof obj === 'object' && obj !== null

/**
Return magic by file magic
@func fileMagic
@param {string} target - absolute path
@returns {(string|number)} 
*/
const fileMagic1 = (target, callback) => 
  child.exec(`file -b '${target}'`, (err, stdout, stderr) => {
    if (err) {
      callback(err)
    } else {
      callback(null, Magic.parse(stdout.toString()))
    }
  })

/**
Return magic by fileType
@func fileMagic2
@param {string} target - absolute path
@returns {(string|number)}
*/

const fileMagic2 = (target, callback) => 
  filetype(target, (err, type) => {
    if (err) return callback(err)
    if (type && type.ext === 'jpg')
      return callback(null, 'JPEG')
    else
      return callback(null, MAGICVER)
  })

/**
const fileMagic3 = (target, callback) => 
  child.exec(`exiftool -S -FileType '${target}'`, (err, stdout, stderr) => {
    console.log(stdout.toString())
    if (err) {
      callback(null, MAGICVER)
    } else {
      let str = stdout.toString().trim()
      let pre = 'FileType: '
      if (str.startsWith(pre)) {
        let type = str.slice(pre.length)
        if (type === 'JPEG') {
          callback(null, 'JPEG')
        } else if (type === 'PNG') {
          callback(null, 'PNG')
        } else {
          callback(null, MAGICVER)
        }
      } else {
        callback(null, MAGICVER)
      } 
    }
  })
**/

const fileMagic4 = (target, callback) => 
  new mmm.Magic().detectFile(target, (err, str) => {
    if (err) {
      fileMagic1(target, callback)
    } else {
      callback(null, Magic.parse(str))
    }
  })

const fileMagic5 = (target, callback) => 
  filetype(target, (err, type) => {
    if (err) return callback(err) 
    if (type && type.ext === 'jpg') {
      callback(null, 'JPEG')
    } else {
      fileMagic4(target, callback)
    }
  })

const fileMagic6 = (target, callback) => 
  filetype(target, (err, type) => {
    if (err) return callback(err) 
    if (type && type.ext === 'jpg') {
      callback(null, 'JPEG')
    } else {
      fileMagic1(target, callback)
    }
  })


const fileMagic = fileMagic6

/** 
Return magic for a regular file. This function uses fileMagic2.
@func fileMagicAsync 
@param {string} target - absolute path
@returns {(string|number)}
**/
const fileMagicAsync = Promise.promisify(fileMagic)


/**
Read and validate xattr, drop invalid properties.

This function do NOT change file/folder or its xattr.

@method readXattrAsync
@param {string} target - absolute path
@param {object} stats - `fs.stats` object for target
@returns {object} - `{attr, dirty}`, dirty available iff attr defined.
@public
*/
const readXattrAsync = async (target, stats) => {

  let raw
  try {
    raw = await xattr.getAsync(target, FRUITMIX)
  } catch (e) {
    if (e.code === 'ENODATA') {
      return
    } else {
      throw e
    }
  }

  let orig, attr = {}
  try {
    orig = JSON.parse(raw)
  } catch (e) {
    return
  }

  let dirty = false

  // validate uuid
  if (typeof orig === 'object' && orig !== null && isUUID(orig.uuid)) {
    attr.uuid = orig.uuid
  } else {
    // if there is no valid uuid, the xattr is totally dropped
    attr.uuid = UUID.v4()
    attr.dirty = undefined
    return attr
  }

  // validate hash and magic for file
  if (stats.isFile()) {
    if (orig.hasOwnProperty('hash')) { 
      if (isSHA256(orig.hash) && orig.time === stats.mtime.getTime()) {
        attr.hash = orig.hash
        attr.time = orig.time
      } else if (isSHA256(orig.hash) && 
        !orig.hasOwnProperty('time') &&
        orig.htime === stats.mtime.getTime() &&
        stats.size <= 1024 * 1024 * 1024) {
        attr.hash = orig.hash
        attr.time = orig.htime
        attr.dirty = undefined
      } else {
        attr.dirty = undefined
      }
    }

    // drop magic if version bumped
    if (Magic.isValidMagic(orig.magic)) {
      attr.magic = orig.magic
    } else {
      attr.dirty = undefined
    }

     // read tags and clean dropped tags
    if (orig.tags && Array.isArray(orig.tags)) {
      let tagsArr = orig.tags
      tagsArr = tagsArr.filter(tag => global.validTagIds.includes(tag))
      attr.tags = tagsArr
      if (tagsArr.length !== orig.tags.length) attr.dirty = undefined
    }
  }

  // remove old data if any TODO remove this code after a few months
  if (orig.hasOwnProperty('owner') || 
    orig.hasOwnProperty('writelist') || 
    orig.hasOwnProperty('readlist')) {
    attr.dirty = undefined
  }

  return attr
}

/**
Read and validate xattr, drop invalid properties

This function is read-only. It does NOT change xattr of target file or directory.

returns null if target has no attr, or attr is not valid JSON.

@func readXattr
@param {string} target - target path
@param {object} stats - `fs.stats` object of target
@param {function} callback - `(err, null | { attr, dirty }) => {}`
*/
const readXattr = (target, stats, callback) => 
  xattr.get(target, FRUITMIX, (err, raw) => {
    if (err && err.code === 'ENODATA') return callback(null, null)
    if (err) return callback(err)

    let orig, attr = {}
    try {
      orig = JSON.parse(raw)
    } catch (e) {
      return callback(null)
    }

    let dirty = false

    // validate uuid
    if (typeof orig === 'object' && orig !== null && isUUID(orig.uuid)) {
      attr.uuid = orig.uuid
      // fall-through
    } else {
      // if there is no valid uuid, the xattr is totally dropped
      attr.uuid = UUID.v4()
      attr.dirty = undefined
      return callback(null, attr)
    }

    // validate hash and magic for file
    if (stats.isFile()) {
      if (orig.hasOwnProperty('hash')) { 
        if (isSHA256(orig.hash) && orig.time === stats.mtime.getTime()) {
          attr.hash = orig.hash
          attr.time = orig.time
        } else if (isSHA256(orig.hash) && 
          !orig.hasOwnProperty('time') &&
          orig.htime === stats.mtime.getTime() &&
          stats.size <= 1024 * 1024 * 1024) {
          attr.hash = orig.hash
          attr.time = orig.htime
          attr.dirty = undefined
        } else {
          attr.dirty = undefined
        }
      }

      // drop magic if version bumped
      if (Magic.isValidMagic(orig.magic)) {
        attr.magic = orig.magic
      } else {
        attr.dirty = undefined
      }

      // read tags and clean dropped tags
      if (orig.tags && Array.isArray(orig.tags)) {
        let tagsArr = orig.tags
        tagsArr = tagsArr.filter(tag => global.validTagIds.includes(tag))
        attr.tags = tagsArr
        if (tagsArr.length !== orig.tags.length) attr.dirty = undefined
      }
    }

    // remove old data if any TODO remove this code after a few months
    if (orig.hasOwnProperty('owner') || 
      orig.hasOwnProperty('writelist') || 
      orig.hasOwnProperty('readlist')) {
      attr.dirty = undefined
    }

    callback(null, attr)
  })

/**
Update target xattr. If target is file and attr has no magic, create it.

@func updateXattrAsync
@param {string} target - absolute path
@param {object} attr - xattr object
@param {boolean} isFile - if target is a file
*/
const updateXattrAsync = async (target, attr, isFile) => {
  if (isFile && !attr.hasOwnProperty('magic')) {
    attr.magic = await fileMagicAsync(target)
  }

  await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr))
  return attr
}

const updateXattr = (target, attr, isFile, callback) => {

  if (isFile && !attr.hasOwnProperty('magic')) {
    fileMagic(target, (err, magic) => {
      if (err) {
        callback(err)
      } else {
        attr.magic = magic
        xattr.set(target, FRUITMIX, JSON.stringify(attr), err => err
          ? callback(err)
          : callback(null, attr))
      }
    })
  } else {
    xattr.set(target, FRUITMIX, JSON.stringify(attr), err => err
      ? callback(err)
      : callback(null, attr))
  }
}

/**
Create a xstat object.

@func createXstat
@param {string} target - absolute path
@param {object} stats - a node.js `fs.stats` object
@param {object} attr - fruitmix xattr object
*/
const createXstat = (target, stats, attr) => {
  let name = path.basename(target)
  let xstat
  if (stats.isDirectory()) {
    xstat = {
      uuid: attr.uuid,
      type: 'directory',
      name,
      mtime: stats.mtime.getTime()
    }
  } 

  if (stats.isFile()) {
    xstat = {
      uuid: attr.uuid,
      type: 'file',
      name,
      mtime: stats.mtime.getTime(),
      size: stats.size,
      magic: attr.magic
    } 
    if (attr.hash) xstat.hash = attr.hash
    if (attr.tags) xstat.tags = attr.tags
  }

  return xstat
}

/**
Read xstat object from target.

@func readXstatAsync
@param {string} target - absolute path
@returns {object} - xstat object
*/
const readXstatAsync = async target => {

  let stats = await fs.lstatAsync(target)
  if (!stats.isDirectory() && !stats.isFile()) {
    let err = new Error('target is neither directory nor regular file')
    err.code = 'EUNSUPPORTEDFILETYPE'
    throw err
  }

  let attr = await readXattrAsync(target, stats)
  if (!attr || attr.hasOwnProperty('dirty')) 
    attr = await updateXattrAsync(target, attr || { uuid: UUID.v4() }, stats.isFile())

  let xstat = createXstat(target, stats, attr)
  return xstat
}

const EUnsupported = stat => {
  let err = new Error('target is not a regular file or directory')

  /** from nodejs 8.x LTS doc
  stats.isFile()
  stats.isDirectory()
  stats.isBlockDevice()
  stats.isCharacterDevice()
  stats.isSymbolicLink() (only valid with fs.lstat())
  stats.isFIFO()
  stats.isSocket()
  */
  if (stat.isBlockDevice()) {
    err.code = 'EISBLOCKDEV'
  } else if (stat.isCharacterDevice()) {
    err.code = 'EISCHARDEV'
  } else if (stat.isSymbolicLink()) {
    err.code = 'EISSYMLINK'
  } else if (stat.isFIFO()) {
    err.code = 'EISFIFO'
  } else if (stat.isSocket()) {
    err.code = 'EISSOCKET'
  } else {
    err.code = 'EISUNKNOWN'
  }

  err.xcode = 'EUNSUPPORTED'
  return err
}

/**
callback version of readXstatAsync
@param {string} target - absolute path for file or dir
@param {function} callback
@alias module:xstat.readXstat
*/
const readXstatOrig = (target, callback) => 
  readXstatAsync(target)
    .then(xstat => callback(null, xstat))
    .catch(e => callback(e))

const readXstatAlt = (target, callback) => 
  fs.lstat(target, (err, stats) => {
    if (err) {
      callback(err)
    } else if (!stats.isDirectory() && !stats.isFile()) {
      callback(EUnsupported(stats))
    } else {
      readXattr(target, stats, (err, attr) => {
        if (err) {
          callback(err)
        } else if (!attr || attr.hasOwnProperty('dirty')) {
          updateXattr(target, attr || { uuid: UUID.v4() }, stats.isFile(), (err, attr) => err
            ? callback(err)
            : callback(null, createXstat(target, stats, attr)))
        } else {
          callback(null, createXstat(target, stats, attr))
        }
      })
    }
  })

const readXstat = readXstatAlt

/**
Update file hash
@func updateFileHashAsync
@param {string} target - absolute file path
@param {string} uuid - file uuid
@param {string} hash - file hash
@param {number} time - timestamp before calculating file fingerprint
@returns {object} updated xstat
*/
const updateFileHashAsync = async (target, uuid, hash, time) => {
  
  if (!isSHA256(hash) || !Number.isInteger(time)) throw new E.EINVAL()

  let stats = await fs.lstatAsync(target)
  if (!stats.isFile()) throw new E.ENOTFILE()
  if (time !== stats.mtime.getTime()) throw new E.ETIMESTAMP()

  let attr = await readXattrAsync(target, stats)
  if (!attr) throw new E.EINSTANCE() // TODO
  if (uuid !== attr.uuid) throw new E.EINSTANCE()

  Object.assign(attr, { hash, time })
  await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr))
  return createXstat(target, stats, attr)
}


/**
callback version of updateFileHashAsync

@param {string} target - absolute path
@param {string} uuid - file uuid
@param {string} hash - file hash
@param {number} time - timestamp before calculating file hash
@param {function} callback - `(err, xstat) => {}`
*/
const updateFileHash = (target, uuid, hash, time, callback) =>
  updateFileHashAsync(target, uuid, hash, time)
    .then(xstat => callback(null, xstat))
    .catch(e => callback(e))

const updateFileHashAlt = (target, uuid, hash, time, callback) => {

  fs.lstat(target, (err, stat) => {
    if (err) return callback(err)
    if (!stat.isFile()) return callback(something ) 
  })
}

/**
Forcefully set xattr with given uuid and/or hash. 

This function should only be used for:
1. drive dir
2. temp file
  1. preserve original uuid and hash for duplicated file
  2. assign fingerprint to file saved from transmission

@param {string} target - absolute path
@param {string} uuid - target uuid
@param {string} hash - file hash (optional)
@returns {object} - xstat object
*/
const forceXstatAsync = async (target, { uuid, hash }) => {
  if (uuid && !isUUID(uuid)) throw new E.EINVAL()
  if (hash && !isSHA256(hash)) throw new E.EINVAL() 

  if (!uuid && !hash) return readXstatAsync(target)

  let stats = await fs.lstatAsync(target)

  // IS THIS NECESSARY? TODO
  if (!stats.isFile() && hash) throw new Error('forceXstatAsync: not a file')

  let attr = { uuid: uuid || UUID.v4() }
  if (hash) Object.assign(attr, { hash, time: stats.mtime.getTime() })

  attr = await updateXattrAsync(target, attr, stats.isFile())
  let xstat = createXstat(target, stats, attr)
  return xstat
}

const forceXstatOrig = (target, opts, callback) => {
  forceXstatAsync(target, opts)
    .then(xstat => callback(null, xstat))
    .catch(e => callback(e))
}

// opt can be undefined, null, empty object
// hash is silently discarded if target is a directory
const forceXstatAlt = (target, opt, callback) => {
  let { uuid, hash } = opt || {}

  if (uuid && !isUUID(uuid)) {
    let err = new Error('invalid uuid')
    err.code = 'EINVAL'
    return callback(err)
  }

  if (hash && !isSHA256(hash)) {
    let err = new Error('invalid hash/fingerprint')
    err.code = 'EINVAL'
    return callback(err)
  }

  fs.lstat(target, (err, stat) => {
    if (err) return callback(err)
    if (!stat.isDirectory() && !stat.isFile()) return callback(EUnsupported(stat))

    let attr = { uuid: uuid || UUID.v4() }
    if (stat.isFile() && hash) {
      attr.hash = hash
      attr.time = stat.mtime.getTime()
    }

    updateXattr(target, attr, stat.isFile(), (err, attr) => {
      if (err) return callback(err) 
      callback(null, createXstat(target, stat, attr))
    })
  })
}

const forceXstat = forceXstatAlt

const assertDirXstatSync = (target, uuid) => {
  let stat = fs.lstatSync(target)
  if (!stat.isDirectory()) {
    let err = new Error('not a directory')
    err.code = 'ENOTDIR'
    throw err
  }

  let attr = JSON.parse(xattr.getSync(target, 'user.fruitmix'))
  if (attr.uuid !== uuid) {
    let err = new Error('uuid mismatch')
    err.code = 'EUUIDMISMATCH'
    throw err
  } 
}

const assertFileXstatSync = (target, uuid) => {
  let stat = fs.lstatSync(target)
  if (!stat.isFile()) {
    let err = new Error('not a file')
    err.code = 'ENOTFILE'
    throw err
  }

  let attr = JSON.parse(xattr.getSync(target, 'user.fruitmix'))
  if (attr.uuid !== uuid) {
    let err = new Error('uuid mismatch')
    err.code = 'EUUIDMISMATCH'
    throw err
  }
}

/**
Update file Tags
@func updateFileHashAsync
@param {string} target - absolute file path
@param {string} uuid - file uuid
@param {array} tags - file tags
@param {number} time - timestamp before calculating file fingerprint
@returns {object} updated xstat
*/
const updateFileTagsAsync = async (target, uuid, tags, time) => {

  if (!Array.isArray(tags) && tags !== undefined || !Number.isInteger(time)) throw new E.EINVAL()
  let stats = await fs.lstatAsync(target)
  if (!stats.isFile()) throw new E.ENOTFILE()
  if (time !== stats.mtime.getTime()) throw new E.ETIMESTAMP()

  let attr = await readXattrAsync(target, stats)
  if (!attr) throw new E.EINSTANCE() // TODO
  if (uuid !== attr.uuid) throw new E.EINSTANCE()

  Object.assign(attr, { tags, time })
  await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr))
  return createXstat(target, stats, attr)
}

module.exports = { 
  readXstat,
  readXstatAsync,
  updateFileHash,
  updateFileHashAsync,
  updateFileTagsAsync,
  forceXstat,
  forceXstatAsync,
  fileMagic6,
  assertDirXstatSync,
  assertFileXstatSync,
}


