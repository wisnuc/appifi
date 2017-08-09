const EventEmitter = require('events').EventEmitter
const crypto = require('crypto')
const stream = require('stream')
const fs = require('fs')

const request = require('superagent')
const uuid = require('uuid')

const requestAsync = require('./request').requestHelperAsync
const Connect = require('./connect')
const broadcast = require('../../common/broadcast')
const boxData = require('../box/boxData')
const Config = require('./const').CONFIG

const Transform = stream.Transform

class HashTransform extends Transform {
  constructor() {
    super()
    this.hashStream = crypto.createHash('sha256')
    this.length = 0
  }

  _transform(buf, enc, next) {
    length += buf.length
    this.hashStream.update(buf, enc)
    this.push(buf)
    next()
  }

  getHash() {
    return this.hashStream.digest('hex')
  }
}

class StoreSingleFile extends EventEmitter {
  constructor(tmp, token, size, hash, jobId) {
    this.tmp = tmp
    this.size = size
    this.hash = hash
    this.token = token
    this.jobId = jobId
  }

  run() {
    
  }

  storeFile(callback) {
    let transform = new HashTransform()
    //TODO: define url
    let url = ''
    let fpath = path.join(this.tmp, uuid.v4())
    let finished = false

    let error = (err) => {
      console.log(err)
      if (finished) return
      finished = true
      return callback(err)
    }
    let finish = (fpath) => {
      if (finished) return
      finished = true
      //TODO: check size sha256
      callback(null, fpath)
    }

    let abort = () => {
      if (finished) return
      finished = true
      callback(new Error('EABORT'))
    }

    let req = request.get(url).set({ 'Authorization': this.token })
    let ws = fs.createWriteStream(fpath)
    
    req.on('response', res => {
      console.log('response')
      if(res.status !== 200){
        error(res.error)
        ws.close()
      }
    })
    req.on('error', error)
    req.on('abort', () => error(new Error('EABORT')))
    ws.on('finish', () => finish(fpath))
    ws.on('error', error())

    req.pipe(transform).pipe(ws)
  }

}

class StoreFiles {
  constructor(tmp, token, sizeArr, hashArr, jobId) {
    this.tmp = tmp
    this.sizeArr = sizeArr
    this.hashArr = hashArr
    this.token = token
    this.jobId = jobId
    this.currentIndex = 0 //当前文件数
    this.currentEndpoint = 0 //当前文件结束位置
    let currentSize = 0
  }

  run() {
    
  }

  storeFiles(callback) {
    //TODO: define url
    let totalSize = 0
    this.sizeArr.forEach(s => totalSize += s)
    this.currentEndpoint = this.sizeArr[0] - 1 // 当前文件结束点
    let url = ''
    let finished = false
    let fpathArr = []
    let hashMaker = new HashTransform()
    let fpath = path.join(this.tmp, uuid.v4())
    let currentWriteable = fs.createWriteStream(fpath)
    hashMaker.pipe(currentWriteable) // pipe

    let error = (err) => {
      console.log(err)
      if (finished) return
      finished = true
      return callback(err)
    }
    let finish = (fpath) => {
      if (finished) return
      finished = true
      //TODO: check size sha256
      callback(null, fpath)
    }

    let abort = () => {
      if (finished) return
      finished = true
      callback(new Error('EABORT'))
    }

    let req = request.get(url).set({ 'Authorization': this.token })
    req.on('error', error)
    req.on('abort', () => error(new Error('EABORT')))
    ws.on('finish', () => finish(fpath))
    ws.on('error', error())
    req.on('response', res => {
      console.log('response')
      if(res.status !== 200){ 
        ws.close()
        return error(res.error)        
      }
      else if(res.get('Content-Length') !== totalSize){ // totalsize error
        ws.close()
        return error(new Error('totalsize mismatch'))
      }
      else{ // run 
        res.on('data', data => {
          let chunk = Buffer.from(data)
          if((chunk + this.currentSize - 1) >= this.currentEndpoint){
            res.pause()
            let needL = chunk.length - (this.currentEndpoint - this.currentSize + 1)
            let w = chunk.slice(0, w)
            hashMaker.write(w)
            let digest = hashMaker.digest('hex')
            
            //TODO: do something
            // 1 write chunk
            // 2 check file
            // 3 new HashMaker new Writeable new endpoint new fpath new index
            // 4 resume res
            // 5 end
            
          }else{
            hashMaker.write(data) //update
            this.currentSize += chunklength
          }
        })
      }
    })
    
    req.end()    
  }

}



class Pipe {
  constructor() {
    this.froot = undefined
    this.tmp = undefined
    this.init()
  }

  init() {
    broadcast.on('FruitmixStart', froot => {
      this.froot = froot
      this.tmp = path.join(froot, 'tmp')
    })
    broadcast.on('Connect_Connected', () => {
      Connect.register('pipe', this.handle.bind(this))
    })
  }

  handle(data) {
    switch (data.type) {
      case 'createTextTweet':
        break
      case 'createBlobTweet':
        break
      case 'createListTweet':
        break
      default:
        break
    }
  }

  async createTextTweetAsync({ boxUUID, guid, comment }) {
    let box = boxData.getBox(boxUUID)
    let props = { comment, global: guid }
    let result = await box.createTweetAsync(props)
    let newDoc = await boxData.updateBoxAsync({ mtime: result.mtime }, box.doc.uuid)

  }

  async errorResponseAsync(error) {
    let url = Config.CLOUD_PATH + '/station'
    let params = { code: error.code, message: error.message }
    await requestAsync('POST', url, { params }, {})
  }

  async successResponseAsync(data) {
    let url = Config.CLOUD_PATH + '/station'
    let params = data
    await requestAsync('POST', url, { params }, {})
  }

  async createBlobTweetAsync({ boxUUID, guid, comment, type, size, sha256 }) {
    // { comment, type: 'blob', id: sha256, global, path: file.path}
    //get blob

  }


  fetchFiles(sizeArr, hashArr, callback) 　{
    if (sizeArr.length === 1) {
      let size = sizeArr[0]

    } else {

    }
  }

}

module.exports = new Pipe()