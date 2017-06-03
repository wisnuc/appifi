const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { Writable, Transform } = require('stream')

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

class HashTransform extends Transform {

  constructor(options) {
    super(options)
    this.size = 0
    this.hash = crypto.createHash('sha256')
  }

  digest() {
    return this.hash.digest('hex')
  }

  transform(chunk, encoding, callback) {
    this.size += chunk.length
    this.hash.update(chunk, encoding)
    this.push(chunk)
    callback()
  }
}

router.put('/', (req, res) => {

  console.log('hello hello')

  let fpath = req.query.path
  let os = fs.createWriteStream(fpath)
  let hash = new HashTransform()

  let finished = false

  const error = err => {

    console.log(err)

    if (finished) return
    finished = true

    req.unpipe()

    let { code, message } = err
    res.status(500).json({ code, message })
  }

  hash.on('error', error)

  os.on('error', error)

  os.on('close', () => {

    console.log('output stream closed, bytesWritten', os.bytesWritten)

    if (finished) return
    finished = true

    os.bytesWritten !== hash.size
      ? res.status(500).json({ message: 'bytesWritten mismatch' })
      : res.status(200).json({ 
          size: hash.size, 
          hash: hash.digest() 
        })
  })

  req.on('aborted', () => {

    console.log('request aborted')

    if (finished) return 
    finished = true 
    req.unpipe() // unpipe all according to node documents
  })

  req.on('close', () => {

    console.log('request closed')

    if (finished) return
    finished = true
    req.unpipe() // unpipe all according to node documents
  })

  req.pipe(os)
})

module.exports = router

