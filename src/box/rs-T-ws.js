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
    this.length = 0
  }

  _transform(buf, enc, next) {
    this.length += buf.length
    this.hashStream.update(buf, enc)
    this.push(buf)
    next()
  }

/**  
  getHash() {
    return this.hashStream.digest('hex')
  }
**/
  
  _flush(next) {
    this.digest = this.hashStream.digest('hex')
    next()
  }
}

class Transfer {
  constructor() {
    this.hashArr = []
    // this.currentIndex = 0     // used to record how many chips in total
    // this.bytesWritten = 0
    // this.totalSize = 0
  }

  storeFile(src, dst, callback) {
    let rs = fs.createReadStream(src)
    let ws = fs.createWriteStream(dst, { flags: 'a'})
    let hashMaker = new HashTransform()
    hashMaker.pipe(ws)
    let finished = false

    let error = (err) => {
      if (finished) return
      finished = true
      return callback(err)
    }

    let finish = (hashArr) => {
      if (finished) return
      finished = true
      return callback(null, hashArr)
    }

    let abort = () => {
      if (finished) return
      finished = true
      return callback(new Error('ABORT'))
    }
    
    // rs.on('data', data => {
    //   let chunk = Buffer.from(data)
    //   if (!hashMaker.length) {
    //     // 1. hashMaker is empty, write data
    //     // 2. push hash into hashArr
    //     console.log('status 1')
    //     console.log(this.hashArr)
    //     hashMaker.pipe(ws)
    //     hashMaker.write(chunk)
    //     let digest = hashMaker.getHash()
    //     this.hashArr.push(digest)
    //   } else if (hashMaker.length < SIZE_1G) {
    //     console.log('status 2')
    //     console.log(this.hashArr)
    //     // 1. hashMaker is non-empty, write data to full
    //     // 2. update hash
    //     // 3. write the rest of data
    //     // 4. push hash of rest data into hashArr
    //     let len = SIZE_1G - hashMaker.length
    //     console.log(1111, hashMaker.length)
    //     // write data to full
    //     // hashMaker.write(chunk.slice(0, len))
        
    //     // update hash in hashArr
    //     // let digest = hashMaker.getHash()
    //     this.hashArr.pop()
    //     this.hashArr.push(digest)
    //     // write the rest of data
    //     hashMaker = new HashTransform()
    //     hashMaker.pipe(ws)
    //     hashMaker.write(chunk.slice(len))
    //     // push hash into hashArr
    //     // this.hashArr.push(hashMaker.getHash())
    //   }
    // })
    console.log(hashMaker.length)
    rs.on('data', data => {
      let chunk = Buffer.from(data)

      if (hashMaker.length + chunk.length >= SIZE_1G) {
        rs.pause()
        // 1. write data to full
        // 2. update hash and push into hashArr
        // 3. write the rest of data
        let len = SIZE_1G - hashMaker.length
        console.log('len',len)
        console.log(1111, hashMaker.length)
        // write data to full
        hashMaker.write(chunk.slice(0, len))
        console.log('lenght1',hashMaker.length)
        // update hash in hashArr
        let digest = hashMaker.getHash()
        this.hashArr.push(digest)
        console.log(this.hashArr)
        // write the rest of data
        hashMaker = new HashTransform()

        console.log('new hashMaker is ready')
        console.log('length2',hashMaker.length)
        hashMaker.pipe(ws)
        hashMaker.write(chunk.slice(len))
        console.log('length3',hashMaker.length)
        
        console.log('aaaa')
        rs.resume()

        // push hash into hashArr
        // this.hashArr.push(hashMaker.getHash())
      } else {
        hashMaker.write(data)
      }
    })

    rs.on('close', () => {
      ws.close()
      console.log('closed')
      let digest = hashMaker.getHash()
      this.hashArr.push(digest)
      console.log(this.hashArr)
      if (this.hashArr.length === 1) finish(digest)
      else {
        hashMaker = new HashTransform()
        hashMaker.write(this.hashArr[0])
        for(let i = 1; i < this.hashArr.length; i++) {
          hashMaker.write(this.hashArr[i])
          digest = hashMaker.getHash()
          if (i === this.hashArr.length - 1) finish(digest)
          else {
            hashMaker = new HashTransform()
            hashMaker.write(digest)
          }
        }
      }     
    })

    rs.on('error', err => error(err))
  }
}


let fpath = '/home/laraine/Projects/appifi/test-files/two-and-a-half-giga'
let dst = '/home/laraine/Projects/appifi/tmptest/two-and-a-half-giga'

// let fpath = '/home/laraine/Projects/appifi/testdata/hello'
// let dst = '/home/laraine/Projects/appifi/tmptest/hello'

let worker = new Transfer()
worker.storeFile(fpath, dst, (err, hashArr) => console.log('hashArr', hashArr))

