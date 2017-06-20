const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const stream = require('stream')
const router = require('express').Router()

/**

The http request stream are saved into a file. The client should provide the file path.

Returns file size and sha256 file hash.

This function does NOT work for empty file (size 0).

@module upload
*/

/**
A stream.Transform implements sha256 hash
*/
class HashTransform extends stream.Transform {

  /**
  Constructor

  @param {number} expectedSize - expected file or file chunk size
  @param {string} expectedSha256 - expected file or file chunk sha256 hash
  */
  constructor(expectedSize, expectedSha256) {

    super()

    this.expectedSize = expectedSize
    this.expectedSha256 = expectedSha256
    this.hash = crypto.createHash('sha256')
    this.size = 0
  }

  /**
  Return true if both size and hash match expected value
  */
  match() {
    return this.size === this.expectedSize && this.hash.digest('hex') === this.expectedSha256
  }

  /**
  Implement `_transform`
  */
  _transform(chunk, encoding, callback) {

    // blocking multiple times of error emission
    if (this.size > this.expectedSize)
      return callback()

    this.size += chunk.length
    if (this.size > this.expectedSize) {
      this.emit('error', new Error('over size'))
      return callback()
    }

    this.hash.update(chunk, encoding)
    this.push(chunk)
    callback()
  }
}

/**
@typedef {Object} UploadResponse
@prop {string} path - path argument, for debugging purpose
@prop {number} size - bytes written into file
@prop {string} sha256 - sha256 hash (hex) string
*/

/**
Upload a file or a file segment, with given expected size and hash.

@function upload
@param {string} path - save upcoming http stream to this file path
@param {number} [size] - expected size
@param {string} [sha256] - expected sha256
@param {number} [offset] - start position
@returns {UploadResponse} path, size, and hash
*/
router.put('/', (req, res) => {

  let { path: filePath, size, sha256, offset } = req.query

  if (!filePath || !path.isAbsolute(filePath))
    return res.status(400).json({ message: 'invalid path' })

  size = parseInt(size)

  if (typeof req.query.path !== 'string')
    return res.status(400).json({ message: 'path must be a valid path' })

  let opts = typeof offset === 'number' 
    ? { flags: 'r+', start: offset} 
    : undefined

  let ws = fs.createWriteStream(filePath, opts)
  let hash = new HashTransform(size, sha256)

  let finished = false

  const error = err => {

    console.log(err)

    if (finished) return 
    finished = true

    res.status(500).json({
      code: err.code,
      message: err.message 
    })

    req.unpipe()
    hash.unpipe() 
  }

  hash.on('error', error)
  ws.on('error', error)
  ws.on('close', () => {

    if (finished) return
    finished = true

    if (hash.match() && size === ws.bytesWritten)
      res.status(200).end()
    else 
      res.status(500).json({ })
    
  })

  req.on('aborted', () => {

    console.log('Sidekick Upload: request aborted')

    if (finished) return 
    finished = true 

    req.unpipe()
  })

  // chain pipe
  req.pipe(hash).pipe(ws)
})

module.exports = router

