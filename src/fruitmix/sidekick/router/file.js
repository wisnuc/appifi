const fs = require('fs')
const crypto = require('crypto')
const { Transform } = require('stream')

const router = require('express').Router()

class HashTransform extends Transform {

  constructor(options) {
    super(options)
    this.hash = crypto.createHash('sha256')
  }

  digest() {
    return this.hash.digest('hex')
  }

  _transform(chunk, encoding, callback) {
    this.hash.update(chunk, encoding)
    this.push(chunk)
    callback()
  }
}

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
