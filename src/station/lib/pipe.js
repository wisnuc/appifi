const EventEmitter = require('events').EventEmitter
const crypto = require('crypto')
const stream = require('stream')
const fs = require('fs')
const path = require('path')

const request = require('superagent')
const uuid = require('uuid')
const debug = require('debug')('station')
const Promise = require('bluebird')

const requestAsync = require('./request').requestHelperAsync
const broadcast = require('../../common/broadcast')
const boxData = require('../../box/boxData')
const Config = require('./const').CONFIG

const Transform = stream.Transform

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

class StoreSingleFile {
  constructor(tmp, token, size, hash, jobId) {
    this.tmp = tmp
    this.size = size
    this.hash = hash
    this.token = token
    this.jobId = jobId
  }

  async runAsync(url) {
    return await this.storeFileAsync(url)
  }

  async storeFileAsync(url)  {
    return Promise.promisify(this.storeFile).bind(this)(url)
  }

  storeFile(url, callback) {
    let transform = new HashTransform()
    //TODO: define url
    let fpath = path.join(this.tmp, uuid.v4())
    let finished = false

    debug('start store')

    let error = (err) => {
      debug(err)
      if (finished) return
      finished = true
      debug('coming error')
      return callback(err)
    }
    let finish = (fpath) => {
      if (finished) return
      debug('store finish')
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
    debug('store req created')
    req.on('response', res => {
      debug('response', fpath)
      if(res.status !== 200){
        debug('response error')
        error(res.error)
        ws.close()
      }
    })
    req.on('error', err => error(err))
    req.on('abort', () => error(new Error('EABORT')))
    ws.on('finish', () => finish(fpath))
    ws.on('error', err => error(err))

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
    let url = ''
    let totalSize = 0
    this.sizeArr.forEach(s => totalSize += s)
    this.currentEndpoint = this.sizeArr[0] - 1 // 当前文件结束点
    let finished = false
    let fpathArr = []
    let hashMaker = new HashTransform()
    let fpath = path.join(this.tmp, uuid.v4())
    let ws = fs.createWriteStream(fpath)
    hashMaker.pipe(ws) // pipe

    let error = (err) => {
      console.log(err)
      if (finished) return
      finished = true
      return callback(err)
    }
    let finish = (fpaths) => {
      if (finished) return
      finished = true
      //TODO: check size sha256
      callback(null, fpaths)
    }

    let abort = () => {
      if (finished) return
      finished = true
      callback(new Error('EABORT'))
    }

    let req = request.get(url).set({ 'Authorization': this.token })
    req.on('error', error)
    req.on('abort', () => error(new Error('EABORT')))
    ws.on('finish', () => finish(fpathArr))
    ws.on('error', error())
    req.on('response', res => {
      console.log('response')
      if(res.status !== 200){ 
        ws.close()
        res.destroy()
        return error(res.error)        
      }
      else if(res.get('Content-Length') !== totalSize){ // totalsize error
        ws.close()
        res.destroy()
        return error(new Error('totalsize mismatch'))
      }
      else{ // run 
        res.on('data', data => {
          let chunk = Buffer.from(data)
          if((chunk + this.currentSize - 1) >= this.currentEndpoint){
            res.pause()
            let needL = chunk.length - (this.currentEndpoint - this.currentSize + 1)
            
            // write last chunk
            hashMaker.write(chunk.slice(0, needL))
            let digest = hashMaker.digest('hex')
            ws.close() // close write stream 
            
            // check hash
            if(digest !== this.currentEndpointhashArr[this.currentIndex])
              return error(`${ this.currentIndex } hash mismatch`)
            
            // save fpath
            fpathArr.push(fpath)
            if(fpathArr.length === this.sizeArr.length) 
              return finish(fpathArr)

            //  create new instance
            fpath = path.join(this.tmp, uuid.v4())
            
            this.currentIndex ++
            this.currentEndpoint += this.sizeArr[this.currentIndex]

            hashMaker = new HashTransform()
            ws = fs.createWriteStream(fpath)
            hashMaker.pipe(ws)
            hashMaker.write(chunk.slice(needL, chunk.length))
            this.currentSize += chunk.length

            //resume
            res.resume()
              
            //TODO: do something
            // 1 write chunk
            // 2 check file
            // 3 new HashMaker new Writeable new endpoint new fpath new index
            // 4 resume res
            // 5 end
            
          }else{
            hashMaker.write(data) // update
            this.currentSize += chunk.length
          }
        })

        res.on('end', () => {

        })

        res.on('error', err => {

        })
      }
    })
    
    req.end()    
  }

}



class Pipe {
  constructor(tmp, connect) {
    this.tmp = undefined
    this.connect = connect
    this.connect.register('pipe', this.handle.bind(this))
  }

  handle(data) {
    let manifest = JSON.parse(data.manifest)
    switch (manifest.type) {
      case 'createTextTweet':
        break
      case 'createBlobTweet':
        break
      case 'createListTweet':
        break
      case 'test':{
        this.test(data)
          .then(res => {})
          .catch(e => debug('test_error: ', e))
      }
        break
      default:
        break
    }
  }

  async test(data) {
    debug(data)
    let url = Config.CLOUD_PATH + 'v1/stations/' + this.connect.saId + '/response/' + data.jobId 
    let store = new StoreSingleFile(this.tmp, this.connect.token, 10000, 'xxxx', data.jobId)
    let fpath = await store.runAsync(url)
    await this.successResponseAsync(1, data.jobId, { type: 'finish', message: 'fuck you'})
  }

  async createTextTweetAsync({ boxUUID, guid, comment }) {
    let box = boxData.getBox(boxUUID)
    let props = { comment, global: guid }
    let result = await box.createTweetAsync(props)
    let newDoc = await boxData.updateBoxAsync({ mtime: result.mtime }, box.doc.uuid)
  }

  async errorResponseAsync(ip, jobId, error) {
    let url = Config.CLOUD_PATH + 'v1/stations/' + this.connect.saId + '/response/' + jobId 
    let params = { code: error.code, message: error.message }
    await requestAsync('POST', url, { params }, {})
  }

  async successResponseAsync(ip, jobId, data) {
    let url = Config.CLOUD_PATH + 'v1/stations/' + this.connect.saId + '/pipe/' + jobId +'/response'
    let params = data
    await requestAsync('POST', url, { params }, {})
  }

  async createBlobTweetAsync({ boxUUID, guid, comment, type, size, sha256, jobId }) {
    // { comment, type: 'blob', id: sha256, global, path: file.path}
    //get blob
    let storeFile = new StoreSingleFile(this.tmp, this.token, size, sha256, jobId)
  }


  fetchFiles(sizeArr, hashArr, callback) 　{
    if (sizeArr.length === 1) {
      let size = sizeArr[0]

    } else {

    }
  }

}

module.exports = Pipe