import path from 'path'
import fs from 'fs'
import child from 'child_process'
import stream from 'stream'
import crypto from 'crypto'
import EventEmitter from 'events'


import xattr from 'fs-xattr'
import Promise from 'bluebird'
import UUID from 'node-uuid'

import  paths from './paths'
import E from '../../lib/error'

Promise.promisifyAll(child)
Promise.promisifyAll(xattr)

let FILEMAP = 'user.filemap'

const createFileMapAsync = async ({ size, segmentsize, nodeuuid, sha256, name, userUUID}) => {
  // fallocate -l 10G bigfile
  let folderPath = path.join(paths.get('filemap'), userUUID)
  try{
    if(!fs.existsSync(folderPath))
      await fs.mkdirAsync(folderPath)
    let taskId = UUID.v4()
    let filepath = path.join(folderPath, taskId)
    await child.execAsync('fallocate -l ' + size +' ' + filepath)
    // may throw xattr ENOENT or JSON SyntaxError
    let segments = []
    for(let i = 0; i < Math.ceil(size/segmentsize); i++){
      segments.push(0)
    }
    let attr = { size, segmentsize, segments, nodeuuid, sha256, name }
    await xattr.setAsync(filepath, FILEMAP, JSON.stringify(attr))
    return Object.assign({},attr,{ taskid: taskId })
  }catch(e){
      console.log(e)
     throw e
     }
}

const deleteFileMap = (userUUID, taskId, callback) => {
  let filePath = path.join(paths.get('filemap'), userUUID,taskId)
  fs.lstat(filePath, err => {
    if(err) return callback(err)
    fs.unlink(filePath, err => {
      if(err) return callback(err)
      callback(null)
    })
  })
}

const readFileMapList = (userUUID, callback) => {
  let folderPath = path.join(paths.get('filemap'), userUUID)
  fs.readdir(folderPath, (err, list) => {
    if(err) return callback(err)
    return callback(null, list.map( f => {
      try{
        let attr = JSON.parse(xattr.getSync(path.join(folderPath, f), FILEMAP))
        if(attr) return Object.assign({}, attr, {taskid: f})
        return undefined
      }catch(e){
        return undefined
      }
    }))
  })
}

const readFileMap = (userUUID, taskId, callback) => {
  let fpath = path.join(paths.get('filemap'), userUUID, taskId)
  if(fs.existsSync(fpath)){
    xattr.get(fpath, FILEMAP, (err, attr) => {
      if(err) return callback(err)
      try{
        return callback(null, Object.assign({}, JSON.parse(attr), {taskid: taskId}))
      }catch(e){
        callback(e)
      }
    })
  }else
    return callback(new Error('filemap not find'))
}

class SegmentUpdater extends EventEmitter{
  constructor(target, stream, offset, segmentHash, segmentSize) {
    super()
    this.finished = false
    this.target = target
    this.stream = stream
    this.offset = offset
    this.segmentHash = segmentHash
    this.segmentSize = segmentSize
    this.onStreamCloseEvent = this.onStreamClose.bind(this)
    this.callback = null
  }

  start(callback) {

    this.listenStream()
    this.callback = callback
    
    let writeStream =  fs.createWriteStream(this.target,{ flags: 'r+', start: this.offset})
    let hash = crypto.createHash('sha256')
    let length = 0
    let hashTransform = new stream.Transform({
      transform: function (buf, enc, next) {
        length += buf.length
        if(length > this.segmentSize){
          this.end()
          return 
        }
        hash.update(buf, enc)
        this.push(buf)
        next()
      }
    })

    hashTransform.on('error', err => this.error(err))

    writeStream.on('error', err => this.error(err))

    writeStream.on('finish', () => {
      if(this.finished) return 
      if(writeStream.bytesWritten !== this.segmentSize) {
        return this.error(new Error('size error'))
      }
        
      if(hash.digest('hex') !== this.segmentHash)
        return this.error(new Error('hash mismatch'))
      console.log('i am comming!')
      this.finish()
    })

    this.stream.pipe(hashTransform).pipe(writeStream)
  }
  
  async startAsync() {
    return Promise.promisify(this.start).bind(this)()
  }

  error(err) {
    if(this.finished) return
    this.finished = true 
    this.cheanUp()
    console.log(err.message)
    // this.emit('error',err)
    if(this.callback) this.callback(err)
  }

  finish() {
    console.log('finish 0')
    if(this.finished ) return
    console.log('finish 1')
    this.finished = true
    this.cheanUp()
    console.log('finish 2')
    // this.emit('finish', null)
    if(this.callback) this.callback(null, 'finish')
  }

  isFinished() {
    return this.finished
  }

  listenStream() {
    if(this.stream)  this.stream.on('close', this.onStreamCloseEvent)      
  }

  removeListenerStream() {
     if(this.stream) this.stream.removeListener('close', this.onStreamCloseEvent)
  }


  onStreamClose() {
    return this.isFinished() || this.abort()
  }

  cheanUp() {
    this.removeListenerStream()
    // this.callback = null
  }

  abort() {
    if(this.finished) return 
    this.finished = true
    this.cheanUp()
    this.emit('abort')
  }
}

const createFileMap = ({ size, segmentsize, nodeuuid, sha256, name, userUUID}, callback) => 
  createFileMapAsync({ size, segmentsize, nodeuuid, sha256, name, userUUID}).asCallback((e, data) => {
    e ? callback(e) : callback(null, data)
  })



export { createFileMap, SegmentUpdater, FILEMAP, readFileMapList, readFileMap, deleteFileMap }