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
          this.filePaths.push(this.appendStream.splitFilePath)
          
          if(this.bytesWritten === this.totalSize && chunk.length === needL)
            return callback()
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