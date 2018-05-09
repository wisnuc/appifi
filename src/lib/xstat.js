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

const Magic = require('./magic')
const E = require('./error')
const { isUUID, isSHA256 } = require('./assertion')

/**
xstat retrieves and stores persistent data in extended attributes.

@module xstat
*/

/** @constant {string} FRUITMIX - `user.fruitmix`, xattr key **/
const FRUITMIX = 'user.fruitmix'

/** @func isNonNullObject **/
const isNonNullObject = obj => typeof obj === 'object' && obj !== null

/**
Generate an unsupported file type error from fs.Stats

@param {fs.Stats} stat
*/
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
    if (type && type.ext === 'jpg') {
      return callback(null, 'JPEG')
    } else {
      return callback(null, MAGICVER)
    }
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

    let orig, attr = {}
    try {
      orig = JSON.parse(raw)
    } catch (e) {
      return callback(null, { uuid: UUID.v4(), dirty: undefined })
    }

    let dirty = false

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

/**
Update target xattr. If target is a file and attr has no magic, create it.

@param {string} target - target path
@param {object} attr - attr
@param {boolean} isFile - if true and attr has no magic, generate it
@param {function(Error, object)} callback
*/
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
Read xstat of target file

@param {string} target - directory or file path
*/
const readXstat = (target, callback) =>
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
    if (!stat.isFile()) return callback(something)
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
  updateFileHash,
  updateFileHashAsync,
  updateFileTagsAsync,
  forceXstat,
  forceXstatAsync,
  fileMagic6,

  // test purpose
  assertDirXstatSync,
  assertFileXstatSync
}
