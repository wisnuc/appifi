const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const xattr = Promise.promisifyAll(require('fs-xattr'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const UUID = require('uuid')

const router = require('express').Router()

const auth = require('../middleware/auth')
const { assert, validateProps, isUUID, isSHA256, isNonNullObject } = require('../lib/assertion')
const sidekick = require('../lib/sidekick-client')

const f = af => (req, res, next) => af(req, res).then(x => x, next)

/**

*/
const userUploadDir = userUUID => path.join(_fruitmixPath, 'uploads', userUUID)

/**
Calculate expected chunk size for given index
*/
const sizeAt = (size, segmentSize, index) => {

  let len = Math.ceil(size / segmentSize)

  if (index >= len) throw new Error('index out of range')

  // not last one
  if (index !== len - 1) return segmentSize 

  // last one but no modulus
  if (size === segmentSize * len) return segmentSize

  // modulus
  return size % sigmentSize
}

/**
Validate an upload attr, uuid is NOT included
*/
const validateUploadAttr = x => {

  assert(isNonNullObject(x), 'not an object')  
  validateProps(x, ['descriptor', 'size', 'segmentSize', 'segments'])

  let { descriptor, size, segmentSize, segments } = x

  // descriptor must be an object
  assert(typeof descriptor === 'object')

  // size must be integer, 0 < x < 1T
  assert(Number.isInteger(size) && size > 0 && size < 1024 * 1024 * 1024 * 1024)

  // segment size must be interger, 0 < x < 1T
  assert(Number.isInteger(segmentSize) && segmentSize > 0 && segmentSize < 1024 * 1024 * 1024 * 1024)

  // segments must be string, containing 1s and 0s
  assert(typeof segments === 'string' && segments.length > 0 && /^[01]*$/.test(segments))
  assert(segments.length === Math.ceil(size /segmentSize))
}

/**
load upload attr from `filePath`, must be a regular file
*/
const loadUploadAttrAsync = async filePath => {

  let stats, attr, upload

  stats = await fs.lstat(filePath)
  if (!stats.isFile()) throw new Error('not a file')

  attr = JSON.parse(await xattr.getAsync(filePath, 'user.fruitmixUpload'))
  validateUploadAttr(attr)
  return attr
}

/**
save upload attr to file 
*/
const saveUploadAttrAsync = async (filePath, attr) => {

  validateUploadAttr(attr)
  await xattr.setAsync(filePath, 'user.fruitmixUpload', JSON.stringify(attr))
}

/**
Get Upload List
*/
router.get('/', auth.jwt(), f(async (req, res) => {

  let userUUID = req.user.uuid

  let dirPath = userUploadDir(userUUID)

  await mkdirpAsync(dirPath)

  let entries = await fs.readdirAsync(dirPath)
  let uploads = await Promise
    .map(entries, async entry => {

      if (!isUUID(entry)) return
      let filePath = path.join(dirPath, entry)
      try {
        let attr = await loadUploadAttrAsync(filePath)
        return attr && Object.assign({ uuid: entry }, attr)
      }
      catch (e) {
      }

    })
    .filter(x => !!x)

  res.status(200).json(uploads)
}))

/**
Create new Upload

@param {object} descriptor
@param {number} size
@param {number} segmengSize
*/
router.post('/', auth.jwt(), f(async (req, res) => {

  let { descriptor, size, segmentSize } = req.body

  if (descriptor !== undefined && typeof descriptor !== 'object')
    return res.status(400).json({ message: 'descriptor must be an object if provided' })

  if (!Number.isInteger(size) || size <= 0 || size >= 1024 * 1024 * 1024 * 1024) 
    return res.status(400).json({ message: 'size must be an integer and 0 < size < 1T' })

  if (!Number.isInteger(segmentSize) || segmentSize <= 0 || segmentSize >= 1024 * 1024 * 1024 * 1024) 
    return res.status(400).json({ message: 'segmentSize must be an integer and 0 < segmentSize < 1T' })

  let userUUID = req.user.uuid

  let dirPath = userUploadDir(userUUID)
  await mkdirpAsync(dirPath)

  let uuid = UUID.v4()
  let filePath = path.join(dirPath, uuid)

  await child.execAsync(`truncate -s ${size} ${filePath}`)
  
  let len = Math.ceil(size / segmentSize)
  let attr = {
    descriptor: descriptor || null,
    size,
    segmentSize,
    segments: new Array(len + 1).join('0')
  }

  await saveUploadAttrAsync(filePath, attr)

  return res.status(200).json(Object.assign({ uuid }, attr))
}))

/**
Get a single Upload
*/
router.get('/:uploadUUID', auth.jwt(), f(async (req, res) => {

  let userUUID = req.user.uuid
  let { uploadUUID } = req.params

  if (!isUUID(uploadUUID)) return res.status(400).end()

  let filePath = path.join(userUploadDir(userUUID), uploadUUID)
  let attr = await loadUploadAttrAsync(filePath)

  return attr
    ? res.status(200).json(Object.assign({ uuid }, attr)) 
    : res.status(404).end()
}))

/**
Delete a Upload, idempotent
*/
router.delete('/:uploadUUID', auth.jwt(), f(async (req, res) => {

  let userUUID = req.user.uuid
  let { uploadUUID } = req.params

  if (!isUUID(uploadUUID)) return res.status(400).end()

  let filePath = path.join(userUploadDir(userUUID), uploadUUID)

  await rimrafAsync(filePath)
  res.status(200).end()

}))

/**
Upload a segment

upload uuid and index is provided in params
sha256 is provided in query string
size is calculated
*/
router.put('/:uploadUUID/segments/:index', auth.jwt(), f(async (req, res) => {

  let userUUID = req.user.uuid
  let { uploadUUID, index } = req.params  
  let { sha256 } = req.query

  sha256 = sha256.toLowerCase()
  index = parseInt(index)

  if (!isUUID(uploadUUID) || !Number.isInteger(index) || !isSHA256(sha256))
    return res.status(400).json('invalid argument')

  let attr = await loadUploadAttrAsync(userUUID, uploadUUID)
  if (!attr) return res.status(404).end()

  let { size, segmentSize, segments } = attr  
  let len = Math.ceil(size / segmentSize)

  if (index < 0 || index >= len) return res.status(400).json('index out of range')

  // PUT is an idempotent method
  if (segments.charAt(index) === '1') return res.status(200).end()

  let dirPath = userUploadDir(userUUID)
  let filePath = path.join(dirPath, uploadUUID)

  let query = {
    path: filepath,
    size: sizeAt(size, segmentSize, index),
    sha256,
    offset: index * upload.segmentSize,
  }

  let status = await sidekick.uploadAsync(query)
  if (status === 200) {

    let nextAttr = Object.assign({}, attr, { 
      segments: attr.substr(0, index) + '1' + attr.substr(index + 1) 
    }) 

    await saveUploadAttrAsync(filePath, nextAttr)
    return res.status(200).end()
  }
  else {
    return res.status(500).json({
      message: `sidekick error with statusCode ${status}`
    })
  }
}))

module.exports = router
