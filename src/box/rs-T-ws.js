const stream = require('stream')
const fs = require('fs')
const crypto = require('crypto')

const Transform = stream.Transform
const SIZE_1G = 1024 * 1024 * 1024
const EMPTY_SHA256_HEX = crypto.createHash('sha256').digest('hex')

class HashTransform extends Transform {
  constructor() {
    super()
    this.hashStream = crypto.createHash('sha256')
    this.size = 0
    this.total = 0
    this.hashArr = []
  }

  _transform(buf, enc, next) {
    if (this.size + buf.length > SIZE_1G) {
      let len = SIZE_1G - this.size
      this.hashStream.update(buf.slice(0, len))
      this.hashArr.push(this.hashStream.digest())

      this.size = buf.slice(len).length
      this.hashStream = crypto.createHash('sha256')
      this.hashStream.update(buf.slice(len))
    } else {
      this.hashStream.update(buf)
      this.size += buf.length
    }

    this.total += buf.length
    this.push(buf)
    next()
  }
  
  _flush(next) {
    this.hashArr.push(this.hashStream.digest())
    next()
  }
}


// method_1     rs -> T -> ws
class Transfer {
  constructor() {}

  storeFile(src, dst, callback) {
    let rs = fs.createReadStream(src)
    let ws = fs.createWriteStream(dst)
    let hashMaker = new HashTransform()
    rs.pipe(hashMaker).pipe(ws)

    hashMaker.on('end', () => {
      console.log('end')
      if (hashMaker.hashArr.length === 1) return callback(null, hashMaker.hashArr[0].toString('hex'))
      else {
        let hash = crypto.createHash('sha256')
        hash.update(hashMaker.hashArr[0])
        for(let i = 1; i < hashMaker.hashArr.length; i++) {
          hash.update(hashMaker.hashArr[i])
          let digest = hash.digest()
          if (i === hashMaker.hashArr.length - 1) return callback(null, digest.toString('hex'))
          else {
            hash = crypto.createHash('sha256')
            hash.update(digest)
          }
        }
      }
    })
  }
}

// method_2: rs -> ws     (when 1G is written, calculate hash)
class Transfer_1 {
  constructor() {
    this.hashArr = []
  }

  storeFile(src, dst, callback) {
    let rs = fs.createReadStream(src)
    let ws = fs.createWriteStream(dst)
    let size = 0, finished = false
    rs.pipe(ws)
    let hashMaker = crypto.createHash('sha256')

    let error = (err) => {
      if (finished) return
      finished = true
      return callback(err)
    }

    let finish = (fingerprint) => {
      if (finished) return
      finished = true
      return callback(null, fingerprint)
    }

    let abort = () => {
      if (finished) return
      finished = true
      return callback(new Error('ABORT'))
    }

    rs.on('data', data => {
      let chunk = Buffer.from(data)

      if (size + chunk.length > SIZE_1G) {
        rs.pause()

        // write data to full, update hash
        let len = SIZE_1G - size
        hashMaker.update(chunk.slice(0, len))
        this.hashArr.push(hashMaker.digest())

        // write the rest of data
        size = chunk.slice(len).length
        hashMaker = crypto.createHash('sha256')
        hashMaker.update(chunk.slice(len))

        rs.resume()
      } else {
        size += chunk.length
        hashMaker.update(chunk)
      }
    })

    rs.on('end', () => {
      console.log('end')
      let digest = hashMaker.digest()
      this.hashArr.push(digest)
      if (this.hashArr.length === 1) finish(digest.toString('hex'))
      else {
        hashMaker = crypto.createHash('sha256')
        hashMaker.update(this.hashArr[0])
        for(let i = 1; i < this.hashArr.length; i++) {
          hashMaker.update(this.hashArr[i])
          digest = hashMaker.digest()
          if (i === this.hashArr.length - 1) finish(digest.toString('hex'))
          else {
            hashMaker = crypto.createHash('sha256')
            hashMaker.update(digest)
          }
        }
      }     
    })

    rs.on('error', err => error(err))
  }
}

// method_3: rs -> ws     (write to destination)
//           rs -> T      (calculate hash)
class Transfer_2 {
  constructor() {}

  storeFile(src, dst, callback) {
    let rs = fs.createReadStream(src)
    let ws = fs.createWriteStream(dst)
    let hashMaker = new HashTransform()

    rs.pipe(ws)
    rs.pipe(hashMaker)

    hashMaker.on('end', () => {
      console.log('end')
      console.log('ws bytes：',ws.bytesWritten)
      console.log('hashMaker bytes: ', hashMaker.total)
      if (ws.bytesWritten !== hashMaker.total)
        return callback(new Error('size mismatch'))
      else {
        if (hashMaker.hashArr.length === 1) return callback(null, hashMaker.hashArr[0].toString('hex'))
        else {
          let hash = crypto.createHash('sha256')
          hash.update(hashMaker.hashArr[0])
          for(let i = 1; i < hashMaker.hashArr.length; i++) {
            hash.update(hashMaker.hashArr[i])
            let digest = hash.digest()
            if (i === hashMaker.hashArr.length - 1) return callback(null, digest.toString('hex'))
            else {
              hash = crypto.createHash('sha256')
              hash.update(digest)
            }
          }
        }
      }
    })


  }
}


// let fpath = '/home/laraine/Projects/appifi/testdata/vpai001.jpg'
// let dst = '/home/laraine/Projects/appifi/tmptest/vpai001.jpg'

// let fpath = '/home/laraine/Projects/appifi/test-files/two-giga'
// let dst = '/home/laraine/Projects/appifi/tmptest/two-giga'

// let fpath = '/home/laraine/Projects/appifi/test-files/two-and-a-half-giga'
// let dst = '/home/laraine/Projects/appifi/tmptest/two-and-a-half-giga'

// let fpath = '/home/laraine/Projects/appifi/test-files/two-giga-minus-1'
// let dst = '/home/laraine/Projects/appifi/tmptest/two-giga-minus-1'

let fpath = '/home/laraine/Projects/appifi/test-files/two-giga-plus-x'
let dst = '/home/laraine/Projects/appifi/tmptest/two-giga-plus-x'

let worker = new Transfer_2()
worker.storeFile(fpath, dst, (err, fingerprint) => {
  if (err) console.log(err)
  console.log('fingerprint', fingerprint)
})

