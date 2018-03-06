const Writable = require('stream').Writable
const fs = require('fs')
const path = require('path')

const uuid = require('uuid')
const debug = require('debug')('station')

const createAppendStream = require('../../lib/fs-append-stream')

const threadify = require('../../lib/threadify')

class SplitStream extends threadify(Writable) {
	constructor(tmp, sizeArr, hashArr) {
    super()
    this.defineSetOnce('error')
    this.define('finishedCount', 0)
    this.define('createFilesCount')
		this.tmp = tmp
		this.sizeArr = sizeArr
		this.hashArr = hashArr
		this.currentIndex = 0
		this.currentEndpoint = sizeArr[0]
		this.totalSize = 0
		this.sizeArr.forEach(s => this.totalSize += s)
    this.bytesWritten = 0
    
    this.filePaths = []
    this.appendStream = this.createStream(path.join(this.tmp, uuid.v4()))
	}

  createStream(fpath) {
    this.createFilesCount ++
    let appendStream = createAppendStream(fpath)
    appendStream.splitFilePath = fpath
    appendStream.on('error', err => {
      this.error = err
    })
    appendStream.on('finish', () => {
      this.finishedCount ++
      console.log(appendStream.digest)
      this.filePaths.push(this.appendStream.splitFilePath)
    })
    return appendStream
  }

	_write(chunk, encoding, callback) {
    this.writeToStream(chunk, encoding, callback)
  }
  
  writeToStream(chunk, encoding, callback) {
    if (this.error) return callback(this.error)
    if (this.bytesWritten + chunk.length >= this.currentEndpoint) {
      let needL = this.currentEndpoint - this.bytesWritten
      this.appendStream.write(chunk.slice(0, needL), encoding, () => {
        
        //update && end current stream
        this.bytesWritten += needL
        this.appendStream.end(() => {
          if(this.bytesWritten === this.totalSize && chunk.length === needL){ 1
            return callback()
          }
          else if(this.bytesWritten === this.totalSize && chunk.length > needL)
            return callback(new Error('size mismatch'))
          else if(this.bytesWritten < this.totalSize){
             // move point to next segment
            this.currentIndex ++
            this.currentEndpoint += this.sizeArr[this.currentIndex]
    
            // new appendStream
            this.appendStream = this.createStream(path.join(this.tmp, uuid.v4()))
            this.writeToStream(chunk.slice(needL), encoding, callback)

          }
          else{
            throw new Error('size error')
          }
        })
        
      })

		}
		else {
			this.appendStream.write(chunk, encoding, () => {
        this.bytesWritten += chunk.length
        callback()
      })
		}
  }

	_destroy(err, callback) {
    callback()
	}

	_final(callback) {
    this.until(() => this.finishedCount === this.createFilesCount)
      .then(() => {
        console.log('finial')
        callback()
      })
	}
}

module.exports = SplitStream



// class StoreFiles {
//   constructor(tmp, token, sizeArr, hashArr, jobId) {
//     this.tmp = tmp
//     this.sizeArr = sizeArr
//     this.hashArr = hashArr
//     this.token = token
//     this.jobId = jobId
//     this.currentIndex = 0 //当前文件数
//     this.currentEndpoint = 0 //当前文件结束位置
//     let currentSize = 0
//   }

//   run() {
    
//   }

//   storeFiles(callback) {
//     //TODO: define url
//     let url = ''
//     let totalSize = 0
//     this.sizeArr.forEach(s => totalSize += s)
//     this.currentEndpoint = this.sizeArr[0] - 1 // 当前文件结束点
//     let finished = false
//     let fpathArr = []
//     let hashMaker = new HashTransform()
//     let fpath = path.join(this.tmp, uuid.v4())
//     let ws = fs.createWriteStream(fpath)
//     hashMaker.pipe(ws) // pipe

//     let error = (err) => {
//       console.log(err)
//       if (finished) return
//       finished = true
//       return callback(err)
//     }
//     let finish = (fpaths) => {
//       if (finished) return
//       finished = true
//       //TODO: check size sha256
//       callback(null, fpaths)
//     }

//     let abort = () => {
//       if (finished) return
//       finished = true
//       callback(new Error('EABORT'))
//     }

//     let req = request.get(url).set({ 'Authorization': this.token })
//     req.on('error', error)
//     req.on('abort', () => error(new Error('EABORT')))
//     ws.on('finish', () => finish(fpathArr))
//     ws.on('error', error())
//     req.on('response', res => {
//       console.log('response')
//       if(res.status !== 200){ 
//         ws.close()
//         res.destroy()
//         return error(res.error)        
//       }
//       else if(res.get('Content-Length') !== totalSize){ // totalsize error
//         ws.close()
//         res.destroy()
//         return error(new Error('totalsize mismatch'))
//       }
//       else{ // run 
//         res.on('data', data => {
//           let chunk = Buffer.from(data)
//           if((chunk + this.currentSize - 1) >= this.currentEndpoint){
//             res.pause()
//             let needL = chunk.length - (this.currentEndpoint - this.currentSize + 1)
            
//             // write last chunk
//             hashMaker.write(chunk.slice(0, needL))
//             let digest = hashMaker.digest('hex')
//             ws.close() // close write stream 
            
//             // check hash
//             if(digest !== this.currentEndpoint[this.currentIndex])
//               return error(`${ this.currentIndex } hash mismatch`)
            
//             // save fpath
//             fpathArr.push(fpath)
//             if(fpathArr.length === this.sizeArr.length) 
//               return finish(fpathArr)

//             //  create new instance
//             fpath = path.join(this.tmp, uuid.v4())
            
//             this.currentIndex ++
//             this.currentEndpoint += this.sizeArr[this.currentIndex]

//             hashMaker = new HashTransform()
//             ws = fs.createWriteStream(fpath)
//             hashMaker.pipe(ws)
//             hashMaker.write(chunk.slice(needL, chunk.length))
//             this.currentSize += chunk.length

//             //resume
//             res.resume()
//             // 1 write chunk
//             // 2 check file
//             // 3 new HashMaker new Writeable new endpoint new fpath new index
//             // 4 resume res
//             // 5 end
            
//           }else{
//             hashMaker.write(data) // update
//             this.currentSize += chunk.length
//           }
//         })

//         res.on('end', () => {

//         })

//         res.on('error', err => {

//         })
//       }
//     })
    
//     req.end()    
//   }

// }

