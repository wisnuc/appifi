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

const path = require('path')
const fs = require('fs')
const child = require('child_process')

const xattr = require('fs-xattr')
const UUID = require('uuid')
const validator = require('validator')

const filetype = require('../lib/filetype')

import E from '../lib/error'  // TODO
import _ from '../lib/async'  // TODO

import { isUUID, isSHA256 } from '../lib/types' // TODO

// TODO
const isNonNullObject = obj => typeof obj === 'object' && obj !== null

// constants
const FRUITMIX = 'user.fruitmix'

// bump version when more file type supported
const UNINTERESTED_MAGIC_VERSION = 0

const parseMagic = text => text.startsWith('JPEG image data') 
  ? 'JPEG' 
  : UNINTERESTED_MAGIC_VERSION

const isMagicUpToDate = magic => 
  (Number.isInteger(magic) && magic >= UNINTERESTED_MAGIC_VERSION) 
    || magic === 'JPEG'

// it's fast, child.exec is sufficient
const fileMagic = (target, callback) => 
  child.exec(`file -b ${target}`, (err, stdout, stderr) => err 
    ? callback(err) 
    : callback(null, parseMagic(stdout.toString())))

const fileMagic2 = (target, callback) => 
  filetype(target, (err, type) => {
    if (err) return callback(err)
    if (type && type.ext === 'jpg')
      return callback(null, 'JPEG')
    else
      return callback(null, UNINTERESTED_MAGIC_VERSION)
  })

const fileMagicAsync = Promise.promisify(fileMagic2)

/**
 * Return timestamp (mtime)
 *
 *
 */
const readTimeStamp = (target, callback) =>
  fs.lstat(target, (err, stats) => err 
    ? callback(err) 
    : callback(null, stats.mtime.getTime()))

// async version of readXstat, simpler to implement than callback version

/**
 * Read xstat (xattr + fs.lstat) from target
 *
 * 
 */
const readXstatAsync = async (target, raw) => {

  let dirty = false, attr

  // if this throws, target may be invalid
  let stats = await fs.lstatAsync(target)
  if (!stats.isDirectory() && !stats.isFile()) throw new E.ENOTDIRFILE()

  // retrieve attr
  try {
    // may throw xattr ENOENT or JSON SyntaxError
    attr = JSON.parse(await xattr.getAsync(target, FRUITMIX))
  }
  catch (e) {
    // unexpected error
    if (e.code !== 'ENODATA' && !(e instanceof SyntaxError)) throw e 
  }

  if (attr) {
    // validate uuid
    if (!isUUID(attr.uuid)) {
      dirty = true
      attr.uuid = UUID.v4()
    }

    // validate hash and magic
    if (stats.isFile()) {

      if (attr.hasOwnProperty('hash') || attr.hasOwnProperty('htime')) { 
        if ( !isSHA256(attr.hash) 
          || !Number.isInteger(attr.htime) // is timestamp
          || attr.htime !== stats.mtime.getTime()) {
          dirty = true
          delete attr.hash
          delete attr.htime
        }
      }

      if (!isMagicUpToDate(attr.magic)) {
        dirty = true
        attr.magic = await fileMagicAsync(target)
      }
    }

    // remove old data TODO remove this code after a few months
    if ( attr.hasOwnProperty('owner')
      || attr.hasOwnProperty('writelist')
      || attr.hasOwnProperty('readlist')) {
      dirty = true 
      delete attr.owner
      delete attr.writelist
      delete attr.readlist
    }
  }
  else {
    dirty = true
    attr = { uuid: UUID.v4() }
    if (stats.isFile()) 
      attr.magic = await fileMagicAsync(target)
  }

  // save new attr if dirty
  if (dirty) await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr)) 

  if (raw) return { stats, attr }

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
  else if (stats.isFile()) {
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

const updateFileHashAsync = async (target, uuid, hash, htime) => {
  
  if (!isSHA256(hash) || !Number.isInteger(htime))
    throw new E.EINVAL()

  let { stats, attr } = await readXstatAsync(target, true)

  if (!stats.isFile()) throw new E.ENOTFILE()
  if (uuid !== attr.uuid) throw new E.EINSTANCE()
  if (htime !== stats.mtime.getTime()) throw new E.ETIMESTAMP()
  
  let attr2 = { uuid: attr.uuid, hash, htime, magic: attr.magic }
  await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr2))

  let attr3 = await xattr.getAsync(target, FRUITMIX)

  return {
    uuid,
    type: 'file',
    name: path.basename(target),
    mtime: stats.mtime.getTime(),
    size: stats.size,
    magic: attr2.magic, 
    hash
  } 
}

const updateFileAsync = async (target, source, hash) => {

  let htime, { stats, attr } = await readXstatAsync(target, true)
  let attr2 = { uuid: attr.uuid }

  if (hash) {
    let stats2 = await fs.lstatAsync(source)
    attr2.hash = hash
    attr2.htime = stats2.mtime.getTime() 
  } 

  await xattr.setAsync(source, FRUITMIX, JSON.stringify(attr2))
  await fs.renameAsync(source, target)
  return await readXstatAsync(target, false)
}


// props may have uuid and/or hash
// if no uuid, a new uuid is generated
const forceFileXattrAsync = async (target, props) => {

  let magic = await fileMagicAsync(target)
  let uuid = props.uuid || UUID.v4()
  let attr = { uuid, magic } 

  if (props.hash) {
    let stats = await fs.statAsync(target)
    attr.hash = props.hash
    attr.htime = stats.mtime.getTime()
  }

  return await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr))
}

// this function is used when init drive
const forceDriveXstatAsync = async (target, driveUUID) => {

  let attr = { uuid: driveUUID }
  await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr))
  return await readXstatAsync(target, false)
}

const readXstat = (target, callback) => 
  readXstatAsync(target, false).asCallback(callback)

const updateFileHash = (target, uuid, hash, htime, callback) =>
  updateFileHashAsync(target, uuid, hash, htime).asCallback(callback)

const updateFile = (target, source, hash, callback) => {
  if (typeof hash === 'function') {
    callback = hash
    hash = undefined
  }
  updateFileAsync(target, source, hash).asCallback(callback)
}

const forceDriveXstat = (target, driveUUID, callback) => 
  forceDriveXstatAsync(target, driveUUID).asCallback(callback) 

export { 

  readTimeStamp,
  readXstat,
  readXstatAsync,
  updateFileHash,
  updateFileHashAsync,
  updateFile,
  updateFileAsync,
  forceDriveXstat,
  forceDriveXstatAsync,
  forceFileXattrAsync,

  // testing only
  parseMagic,
  fileMagic,
}


