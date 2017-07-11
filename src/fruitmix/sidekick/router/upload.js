const fs = require('fs')
const crypto = require('crypto')
const stream = require('stream')
const router = require('express').Router()
const debug = require('debug')('sidekick')


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
  */
  constructor (expectedSize) {
    super()
    this.expectedSize = expectedSize
    this.hash = crypto.createHash('sha256')
    this.size = 0
  }

  /**
  Digest
  */
  digest() {
    return this.sha256 || (this.sha256 = this.hash.digest('hex'))
  }

  /**
  Implement `_transform`
  */
  _transform (chunk, encoding, callback) {

    // blocking multiple times of error emission
    if (this.size > this.expectedSize) return callback()

    this.size += chunk.length
    if (this.size > this.expectedSize) {

      debug(`oversize error occurred, expected: ${this.expectedSize}, actual: ${this.size}`)

      let e = new Error('oversize error occurred')
      e.status = 409

      this.emit('error', e)
      return callback()
    }

    this.hash.update(chunk, encoding)
    this.push(chunk)
    callback()
  }
}

/**
This router function uploads a file or a file chunk, with given expected size.

`path` and `size` must be provided by client.

If `offset` is provided, it is writing a file chunk. The file must exists already, otherwise the function fails.

If `offset` is not provided, it is writing a file. The file will be created if it does not exist.

In either case, a sha256 is optional. If provided, and it is inconsistent with values calculated, the function fails.

@function upload
@param {stream} req
@param {string} req.query.path - save upcoming http stream to this file path
@param {number} req.query.size - expected size
@param {string} [req.query.sha256] - expected sha256
@param {number} [req.query.offset] - start position
@param {stream} res
@param {string} res.body.path - `return` path, for debug
@param {number} res.body.size - `return` actual size received
@param {string} res.body.sha256 - `return` file or file chunk sha256
@returns 200 for success
@returns 400 if path or size invalid
@returns 409 if size or hash mismatch
@returns 500 for internal error
*/
router.put('/', (req, res, next) => {

  let { path, sha256, offset } = req.query
  let size = parseInt(req.query.size)

  if (!path) return res.status(400).json({ message: 'invalid path' }) 
  if ( '' + size !== req.query.size || size <= 0 || size > 1024 * 1024 * 1024 * 1024 * 256) 
    return res.status(400).json({ message: 'invalid size' })

  let opts = typeof offset === 'number' ? { flags: 'r+', start: offset } : undefined
  let ws = fs.createWriteStream(path, opts)
  let hash = new HashTransform(size, sha256)
  let finished = false

  const error = err => {
    if (finished) return
    finished = true
    req.unpipe()
    hash.unpipe()
    res.status(err.status || 500).json({ code: err.code, message: err.message })
  }

  hash.on('error', error)
  ws.on('error', error)

  ws.on('close', () => {
    if (finished) return
    finished = true
    if (size !== hash.size || size !== ws.bytesWritten) return res.status(409).end()
    if (sha256 && sha256 !== hash.digest()) return res.status(409).end()
    res.status(200).json({ path, size, sha256: hash.digest() })
  })

  req.on('aborted', () => {
    if (finished) return
    finished = true
    req.unpipe()
    hash.unpipe()
  })

  req.pipe(hash).pipe(ws)
})

module.exports = router
