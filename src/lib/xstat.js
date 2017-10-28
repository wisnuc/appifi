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

const xattr = Promise.promisifyAll(require('fs-xattr'))
const UUID = require('uuid')
const validator = require('validator')

const filetype = require('./file-type')

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

magic is mandatory. hash and htime is optional, but they must exist together.

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

/** @constant {number} MAGICVER - bump version for magic **/
const MAGICVER = 1

/** @func isNonNullObject **/
const isNonNullObject = obj => typeof obj === 'object' && obj !== null

/** @func isValidMagic **/
const isValidMagic = magic => { 
  if ((Number.isInteger(magic) && magic >= MAGICVER) || 
    magic === 'JPEG' ||
    magic === 'PNG') {
    return true
  } else {
    return false
  }
}

/** 
Parse file magic output to magic 
@func parseMagic
@param {string} text
@returns {(string|number)}
*/
const parseMagic = text => {
  if (text.startsWith('JPEG image data')) {
    return 'JPEG'
  } else if (text.startsWith('PNG image data')) {
    return 'PNG'
  } else {
    return MAGICVER
  }
}

/**
Return magic by file magic
@func fileMagic
@param {string} target - absolute path
@returns {(string|number)} 
*/
const fileMagic1 = (target, callback) => 
  child.exec(`file -b ${target}`, (err, stdout, stderr) => {
    if (err) {
      callback(err)
    } else {
      callback(null, parseMagic(stdout.toString()))
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
Return magic for a regular file. This function uses fileMagic2.
@func fileMagicAsync 
@param {string} target - absolute path
@returns {(string|number)}
**/
const fileMagicAsync = Promise.promisify(fileMagic1)

/**
Read and validate xattr, drop invalid properties.

This function do NOT change file/folder or its xattr.

Tests:
+ throw EUNSUPPORTEDFILETYPE if not dir or file
+ return null attr if no attr (file, no dirty)
+ return null attr if no attr (dir, no dirty)
+ return null attr if attr not json (file, dirty)
+ return null attr if attr not json (dir, dirty)
+ return attr with valid if uuid invalid (file, dirty)
+ return attr with valid if uuid invalid (dir, dirty)
+ drop hash and time if attr has only hash (file, dirty)
+ drop hash and time if attr has only htime (file, dirty)
+ drop hash and time if hash invalid (file, dirty)
+ drop hash and time if htime invalid (file, dirty)
+ drop hash and time if htime outdated (file, dirty) 
+ drop magic if invalid (file, dirty)
+ drop magic if outdated (file, dirty)
+ drop owner if attr has owner (file, dirty)
+ drop owner if attr has owner (dir, dirty)
+ drop writelist if attr has writelist (file, dirty)
+ drop writelist if attr has writelist (dir, dirty)
+ drop readlist if attr has readlist (file, dirty)
+ drop readlist if attr has readlist (dir, dirty)

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
    if (isValidMagic(orig.magic)) {
      attr.magic = orig.magic
    } else {
      attr.dirty = undefined
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
Update target xattr. If target is file and attr has no magic, create it.

Tests:
+ test1
+ test2

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
  } else if (stats.isFile()) {
    xstat = {
      uuid: attr.uuid,
      type: 'file',
      name,
      mtime: stats.mtime.getTime(),
      size: stats.size,
      magic: attr.magic,
    } 
    if (attr.hash) xstat.hash = attr.hash
  }

  return xstat
}

/**
Read xstat object from target.

Tests:
+ disk1
+ disk2

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

/**
callback version of readXstatAsync
@param {string} target - absolute path for file or dir
@param {function} callback
@alias module:xstat.readXstat
*/
const readXstat = (target, callback) => 
  readXstatAsync(target)
    .then(xstat => callback(null, xstat))
    .catch(e => callback(e))

/**
Update file hash
@func updateFileHashAsync
@param {string} target - absolute file path
@param {string} uuid - file uuid
@param {string} hash - file hash
@param {number} htime - timestamp before calculating file hash
@returns {object} updated xstat
*/
const updateFileHashAsync = async (target, uuid, hash, htime) => {
  
  if (!isSHA256(hash) || !Number.isInteger(htime)) throw new E.EINVAL()

  let stats = await fs.lstatAsync(target)
  if (!stats.isFile()) throw new E.ENOTFILE()
  if (htime !== stats.mtime.getTime()) throw new E.ETIMESTAMP()

  let { attr, dirty } = await readXattrAsync(target, stats)
  if (!attr) throw new E.EINSTANCE() // TODO
  if (uuid !== attr.uuid) throw new E.EINSTANCE()

  Object.assign(attr, { hash, htime })
  await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr))
  return createXstat(target, stats, attr)
}

/**
callback version of updateFileHashAsync

@param {string} target - absolute path
@param {string} uuid - file uuid
@param {string} hash - file hash
@param {number} htime - timestamp before calculating file hash
@param {function} callback - `(err, xstat) => {}`
*/
const updateFileHash = (target, uuid, hash, htime, callback) =>
  updateFileHashAsync(target, uuid, hash, htime)
    .then(xstat => callback(null, xstat))
    .catch(e => callback(e))

/**
Forcefully set xattr with given uuid and/or hash. 

This function should only be used for:
1. drive dir
2. temp file

Tests:
+ test1
+ test2

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
  if (hash) Object.assign(attr, { hash, htime: stats.mtime.getTime() })

  attr = await updateXattrAsync(target, attr, stats.isFile())
  let xstat = createXstat(target, stats, attr)
  return xstat
}

const forceXstat = (target, opts, callback) => {

  forceXstatAsync(target, opts)
    .then(xstat => callback(null, xstat))
    .catch(e => callback(e))
}

module.exports = { 
  readXstat,
  readXstatAsync,
  updateFileHash,
  updateFileHashAsync,
  forceXstat,
  forceXstatAsync
}


