const stream = require('stream')
const fs = require('fs')
const crypto = require('crypto')

const Transform = stream.Transform
const SIZE_1G = 1024 * 1024 * 1024

// let fpath = '/home/laraine/Projects/appifi/test-files/two-and-a-half-giga'
// let dst = '/home/laraine/Projects/appifi/tmptest/two-and-a-half-giga'

class HashTransform extends Transform {
  constructor() {
    super()
    this.hashStream = crypto.createHash('sha256')
    this.length = 0
  }

  _transform(buf, enc, next) {
    this.length += buf.length
    this.hashStream.update(buf, enc)
    this.push(buf)
    next()
  }

  getHash() {
    return this.hashStream.digest('hex')
  }
}

class Transfer {
  constructor() {
    this.hashArr = []
    this.currentIndex = 0     // used to record how many chips in total
    // this.currentEndpoint = 0
    // this.currentSize = 0
  }

  storeFile(src, dst) {
    let rs = fs.createReadStream(src)
    let ws = fs.createWriteStream(dst, { flags: 'a'})
    let chunk
    let hashMaker = new HashTransform()

    rs.on('data', data => {
      let chunk = Buffer.from(data)
      let segments = Math.ceil(chunk.length / SIZE_1G)

      
      
    })
  }
}


const trans = (src, dst) => {
  let rs = fs.createReadStream(src)
  let ws = fs.createWriteStream(dst)

  rs.on('data', )
}
