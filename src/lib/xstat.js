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

const filetype = require('./file-type')
const EUnsupported = require('./unsupported-file')

const Magic = require('./magic')

const fileMeta = require('./file-meta')

const { isUUID, isSHA256 } = require('./assertion')

/**
A valid tags is an array of sorted, unique, natural numbers (N0)
*/
const isValidTags = tags => Array.isArray(tags) &&
  tags.every(id => Number.isInteger(id) && id >= 0) &&
  tags.every((id, i, a) => i === 0 || a[i - 1] < id)

/**
xstat retrieves and stores persistent data in extended attributes.

@module xstat
*/

/** @constant {string} FRUITMIX - `user.fruitmix`, xattr key **/
const FRUITMIX = 'user.fruitmix'

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

const fileMagic6 = (target, callback) =>
  filetype(target, (err, type) => {
    if (err) return callback(err)
    if (type && type.ext === 'jpg') {
      callback(null, 'JPEG')
    } else if (type && type.ext === 'png') {
      callback(null, 'PNG')
    } else if (type && type.ext === 'gif') {
      callback(null, 'GIF')
    } else if (type && type.ext === 'bmp') {
      callback(null, 'BMP')
    } else if (type && type.ext === '3GP') {
      callback(null, '3GP')
    } else if (type && type.ext === 'mp4') {
      callback(null, 'MP4')
    } else {
      fileMagic1(target, callback)
    }
  })

const fileMagic = fileMagic6

/**
@callback readXattrCallback
@param {Error} err
@param {object} attr - xattr object
*/

/**
Read and validate xattr, drop invalid properties

This function is read-only. It does NOT change xattr of target file or directory.

returns null if target has no attr, or attr is not valid JSON.

@param {string} target - target path
@param {object} stats - `fs.Stats` of target file
@param {module:xstat~readXattrCallback} callback
*/
const readXattr = (target, stats, callback) => {
  if (!(stats instanceof fs.Stats) || !(stats.isFile() || stats.isDirectory())) {
    return process.nextTick(() => callback(new Error('invalid stats')))
  }

  xattr.get(target, FRUITMIX, (err, raw) => {
    if (err && err.code === 'ENODATA') return callback(null, { uuid: UUID.v4(), dirty: undefined })
    if (err) return callback(err)

    let orig
    let attr = {}
    try {
      orig = JSON.parse(raw)
    } catch (e) {
      return callback(null, { uuid: UUID.v4(), dirty: undefined })
    }

    // validate uuid
    if (typeof orig === 'object' && orig !== null && !Array.isArray(orig) && isUUID(orig.uuid)) {
      attr.uuid = orig.uuid
      // fall-through
    } else {
      // if there is no valid uuid, the xattr is totally dropped
      return callback(null, { uuid: UUID.v4(), dirty: undefined })
    }

    if (stats.isDirectory()) {
      if (Object.keys(orig).length !== 1) attr.dirty = undefined
    } else {
      if (orig.hasOwnProperty('hash') || orig.hasOwnProperty('time')) {
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
      /** remove magic in future TODO FIXME
      if (Magic.isValidMagic(orig.magic)) {
        attr.magic = orig.magic
      } else {
        attr.dirty = undefined
      }
      */

      if (orig.magic) {
        attr.dirty = undefined 
      }

      if (fileMeta.validate(orig.metadata)) {
        attr.metadata = orig.metadata
      } else {
        attr.dirty = undefined
      }

      if (orig.tags !== undefined) {
        // valid tags must:
        // 1. be an array of ids
        // 2. and all ids are integer and >= 0
        // 3. no dup and sorted
        if (!Array.isArray(orig.tags)) {
          attr.dirty = undefined
        } else {
          let filtered = orig.tags.filter(id => Number.isInteger(id) && id >= 0)
          if (filtered.length === 0) {
            attr.dirty = undefined
          } else {
            let sorted = Array.from(new Set(filtered)).sort()
            if (sorted.join() === orig.tags.join()) {
              attr.tags = orig.tags
            } else {
              attr.tags = sorted
              attr.dirty = undefined
            }
          }
        }
      }
    }
    callback(null, attr)
  })
}

const readXattrAsync = Promise.promisify(readXattr)

/**
Update target xattr. If target is a file and attr has no magic, create it.

@param {string} target - target path
@param {object} attr - attr
@param {boolean} isFile - if true and attr has no magic, generate it
@param {function(Error, object)} callback
*/
const updateXattr = (target, attr, isFile, callback) => {
  if (isFile && !attr.hasOwnProperty('metadata')) {
/**
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
**/

    fileMeta(target, (err, metadata) => {
      if (err) {
        callback(err)
      } else {
        attr.metadata = metadata
        xattr.set(target, FRUITMIX, JSON.stringify(attr), err => 
          err ? callback(err) : callback(null, attr))
      }
    })
  } else {
    xattr.set(target, FRUITMIX, JSON.stringify(attr), err => err
      ? callback(err)
      : callback(null, attr))
  }
}

const updateXattrAsync = Promise.promisify(updateXattr)

/**
Create a xstat object from fs.Stats and attr

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
  } else {
    xstat = {
      uuid: attr.uuid,
      type: 'file',
      name,
      mtime: stats.mtime.getTime(),
      size: stats.size,
    }
    if (attr.hash) xstat.hash = attr.hash
    if (attr.tags) xstat.tags = attr.tags
    if (attr.metadata.type !== '_') {
      let metadata = Object.assign({}, attr.metadata)
      delete metadata.ver
      xstat.metadata = metadata
    }
  }

  return xstat
}

/**
This is not the best solution for readXstat race. TODO
However, the best solution requires all fs operations avoid putting attr-less object
into underlying vfs. A spinlock is a must simpler solution.
spinlock
*/
const lockset = new Set()

/**
Read xstat of target file

@param {string} target - directory or file path
*/
const readXstat1 = (target, callback) =>
  fs.lstat(target, (err, stats) => {
    if (err) {
      callback(err)
    } else if (!stats.isDirectory() && !stats.isFile()) {
      callback(EUnsupported(stats))
    } else {
      readXattr(target, stats, (err, attr) => {
        if (err) {
          callback(err)
        } else if (attr.hasOwnProperty('dirty')) {
          updateXattr(target, attr, stats.isFile(), (err, attr) => {
            if (err) {
              callback(err)
            } else {
              callback(null, createXstat(target, stats, attr))
            }
          })
        } else {
          callback(null, createXstat(target, stats, attr))
        }
      })
    }
  })

const readXstatAsync = async target => {
  let stats = await fs.lstatAsync(target)
  if (!stats.isDirectory() && !stats.isFile()) throw EUnsupported(stats)

  while (lockset.has(target)) await Promise.delay(0)
  lockset.add(target)
  try {
    let attr = await readXattrAsync(target, stats) 
    if (attr.hasOwnProperty('dirty')) {
      attr = await updateXattrAsync(target, attr, stats.isFile()) 
    }
    let xstat = createXstat(target, stats, attr)
    return xstat
  } finally {
    lockset.delete(target)
  } 
}

const readXstat2 = (target, callback) => 
  readXstatAsync(target)
    .then(xstat => callback(null, xstat)) 
    .catch(err => callback(err))

const readXstat = readXstat2

/**
Set xattr forcefully

This function is supposed to be used only for temporary file

@param {string} target - target file path
@param {object} props
@param {string} [props.uuid] - preserve uuid
@param {string} [props.hash] - preserve fingerprint
@param {number[]} [props.tags] - preserve tags, accept empty array
*/
const forceXstat = (target, props, callback) => {
  let { uuid, hash, tags } = props || {}

  if (uuid && !isUUID(uuid)) {
    let err = new Error('invalid uuid')
    err.code = 'EINVAL'
    return process.nextTick(() => callback(err))
  }

  uuid = uuid || UUID.v4()

  if (hash && !isSHA256(hash)) {
    let err = new Error('invalid hash/fingerprint')
    err.code = 'EINVAL'
    return process.nextTick(() => callback(err))
  }

  if (tags) {
    if (!Array.isArray(tags) || !tags.every(id => Number.isInteger(id) && id >= 0)) {
      let err = new Error('invalid tags')
      err.code = 'EINVAL'
      return process.nextTick(() => callback(err))
    }

    if (tags.length === 0) tags = undefined
  }

  fs.lstat(target, (err, stat) => {
    if (err) return callback(err)
    if (!stat.isDirectory() && !stat.isFile()) return callback(EUnsupported(stat))

    let attr = { uuid }
    if (stat.isFile()) {
      if (hash) {
        attr.hash = hash
        attr.time = stat.mtime.getTime()
      }
      if (tags) attr.tags = tags
    }

    updateXattr(target, attr, stat.isFile(), (err, attr) => {
      if (err) return callback(err)
      callback(null, createXstat(target, stat, attr))
    })
  })
}

/**
async version of forceXstat

@function
*/
const forceXstatAsync = Promise.promisify(forceXstat)

/**
Update file hash

@param {string} target - absolute path
@param {string} uuid - file uuid
@param {string} hash - file hash
@param {number} time - timestamp before calculating file hash
@param {function} callback - `(err, xstat) => {}`
*/
const updateFileHash = (target, uuid, hash, time, callback) => {
  // validate arguments
  try {
    if (!isUUID(uuid)) throw new Error('invalid uuid')
    if (!isSHA256(hash)) throw new Error('invalid hash')
    if (Number.isInteger(time)) throw new Error('invalid time')
  } catch (err) {
    err.code = 'EINVAL'
    return process.nextTick(() => callback(err))
  }

  fs.lstat(target, (err, stats) => {
    if (err) return callback(err)
    if (!stats.isFile()) {
      let err = new Error('not a file')
      err.code = 'ENOTFILE'
      return callback(err)
    }

    if (time !== stats.mtime.getTime()) {
      let err = new Error('timestamp mismatch')
      err.code = 'ETIMESTAMP'
      return callback(err)
    }

    readXattr(target, stats, (err, attr) => {
      if (err) return callback(err)
      if (uuid !== attr.uuid) {
        let err = new Error('uuid mismatch')
        err.code = 'EINSTANCE'
        return callback(err)
      }

      Object.assign(attr, { hash, time })
      xattr.set(target, FRUITMIX, JSON.stringify(attr), err => {
        if (err) {
          callback(err)
        } else {
          callback(null, createXstat(target, stats, attr))
        }
      })
    })
  })
}

/**
async version of updateFileHash

@function
*/
const updateFileHashAsync = Promise.promisify(updateFileHash)

/**
Update file tags

@param {string} target - absolute file path
@param {string} uuid - file uuid
@param {number[]} tags - file tags
*/
const updateFileTags = (target, uuid, tags, callback) => {
  try {
    if (!isUUID(uuid)) throw new Error('invalid uuid')
    if (!isValidTags(tags)) throw new Error('invalid tags')
  } catch (err) {
    err.code = 'EINVAL'
    return process.nextTick(() => callback(err))
  }

  fs.lstat(target, (err, stats) => {
    if (err) return callback(err)
    if (!stats.isFile()) {
      let err = new Error('not a file')
      err.code = 'ENOTFILE'
      return callback(err)
    }

    readXattr(target, stats, (err, attr) => {
      if (err) return callback(err)
      if (uuid !== attr.uuid) {
        let err = new Error('uuid mismatch')
        err.code = 'EINSTANCE'
        return callback(err)
      }

      Object.assign(attr, { tags: tags.length === 0 ? undefined : tags })
      xattr.set(target, FRUITMIX, JSON.stringify(attr), err => {
        if (err) {
          callback(err)
        } else {
          callback(null, createXstat(target, stats, attr))
        }
      })
    })
  })
}

/**
async version of updateFileTags

@function
*/
const updateFileTagsAsync = Promise.promisify(updateFileTags)

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

module.exports = {
  fileMagic6,
  readXstat,
  forceXstat,
  forceXstatAsync,
  updateFileHash,
  updateFileHashAsync,
  updateFileTags,
  updateFileTagsAsync,
  assertDirXstatSync,
  assertFileXstatSync
}
