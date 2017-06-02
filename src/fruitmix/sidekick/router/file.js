const fs = require('fs')
const crypto = require('crypto')
const Writable = require('stream').Writable

const UUID = require('uuid')
const router = require('express').Router()

class HashStream extends Writable {

  constructor(options) {
    super(options)

    this.bytesWritten = 0 
    this.hash = crypto.createHash('sha256')
  }

  digest() {
    return this.hash.digest('hex')
  }

  write(chunk, encoding) {
    this.bytesWritten += chunk.length
    this.hash.update(chunk, encoding)
  }
}

router.put('/', (req, res) => {

  let uuid = UUID.v4() 
  let os = fs.createWriteStream(uuid)
  let hash = new HashStream()

  let finished = false
  let count = 2 

  const finalize = () => {
    if (os.bytesWritten !== hash.bytesWritten)  
      return res.status(500).json({
        message: 'bytesWritten mismatch'
      })

    res.status(200).json({
      uuid,
      size: hash.bytesWritten,
      hash: hash.digest()
    })
  }

  hash.on('error', err => {
    if (finished) return 
    finished = true
    res.status(500).json({
      code: err.code,
      message: err.message 
    })
  })

  hash.on('finish', () => {
    if (finished) return
    count--
    if (count === 0) finalize()
  })

  os.on('error', err => {
    if (finished) return
    finished = true
    res.status(500).json({
      code: err.code,
      message: err.message
    })
  })

  os.on('close', () => {
    if (finished) return
    count--
    if (count === 0) finalize() 
  })

  req.on('error', () => {
    if (finished) return 
    finished = true 
  })

  req.on('close', () => {
    if (finished) return
  })

  req.pipe(hash)
  req.pipe(os)
})

module.exports = router
