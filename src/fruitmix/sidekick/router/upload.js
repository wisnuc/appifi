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

  @param {object} options - options
  */
  constructor(options) {
    super(options)
    this.hash = crypto.createHash('sha256')
  }

  /**
  Return digest (after stream close)
  */
  digest() {
    return this.hash.digest('hex')
  }

  /**
  Implement `_transform`
  */
  _transform(chunk, encoding, callback) {
    this.hash.update(chunk, encoding)
    this.push(chunk)
    callback()
  }
}

/**
@typedef {Object} UploadResponse
@prop {string} path - path argument, for debugging purpose
@prop {number} size - bytes written into file
@prop {string} hash - sha256 hash (hex) string
*/

/**
Upload a file, save to given path and return size and hash.

@function upload
@param {string} path - save upcoming http stream to this file path
@returns {UploadResponse} path, size, and hash
*/
router.put('/', (req, res) => {

  let os = fs.createWriteStream(req.query.path)
  let hash = new HashTransform()
  let finished = false

  const error = err => {
    if (finished) return 
    finished = true
    res.status(500).json({
      code: err.code,
      message: err.message 
    })
  }

  hash.on('error', err => error(err))
  os.on('error', err => error(err))

  os.on('close', () => {
    if (finished) return
    finished = true
    res.status(200).json({
      path: req.query.path,
      size: os.bytesWritten,
      hash: hash.digest()
    })
  })

  req.on('aborted', () => {
    if (finished) return 
    finished = true 
    req.unpipe()
  })

  req.pipe(hash).pipe(os)

})

module.exports = router

