import path from 'path'
import fs from 'fs'
import child from 'child_process'
import stream from 'stream'
import crypto from 'crypto'
import EventEmitter from 'events'

import xattr from 'fs-xattr'
import Promise from 'bluebird'
import UUID from 'node-uuid'
import mkdirp from 'mkdirp'

import  paths from './paths'
import E from '../../lib/error'
import config from '../config'
import { mkdirpAsync } from '../../../common/async'

let FILEMAP = 'user.filemap'

const createFileMapAsync = async ({ size, segmentsize, dirUUID, sha256, name, userUUID}) => {
  // fallocate -l 10G bigfile
  let folderPath = path.join(paths.get('filemap'), userUUID)
  try{
    // if(!fs.existsSync(folderPath))
    await mkdirpAsync(folderPath)
    let taskId = UUID.v4()
    let filepath = path.join(folderPath, taskId)
    await child.execAsync('fallocate -l ' + size +' ' + filepath)
    let segments = []
    for(let i = 0; i < Math.ceil(size/segmentsize); i++){
      segments.push(0)
    }
    let attr = { size, segmentsize, segments, dirUUID, sha256, name, userUUID }
    await xattr.setAsync(filepath, FILEMAP, JSON.stringify(attr))
    return Object.assign({},attr,{ taskid: taskId })
  }
  catch(e){ throw e }
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
    if(this.finished ) return
    this.finished = true
    this.cheanUp()
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

// 1. retrieve target async yes
// 2. validate segement arguments no
// 3. start worker async
// 4. update file xattr async

const updateSegmentAsync = async (userUUID, nodeUUID, segmentHash, start, taskId, req) => {
  let folderPath = path.join(paths.get('filemap'), userUUID)
  let fpath = path.join(folderPath, taskId)
  let attr = JSON.parse(await xattr.getAsync(fpath, FILEMAP))
  let segments = attr.segments

  if(segments.length < (start + 1))
    throw new E.EINVAL()
  if(segments[start] === 1)
    throw new E.EEXISTS()
  
  let segmentSize = attr.segmentsize
  let segmentLength = segments.length > start + 1 ? segmentSize : (attr.size - start * segmentSize)
  let position = attr.segmentsize * start

  let updater = new SegmentUpdater(fpath, req, position, segmentHash, segmentLength)

  await updater.startAsync()

  attr = JSON.parse(await xattr.getAsync(fpath, FILEMAP))
  attr.segments[start] = 1
  await xattr.setAsync(fpath, FILEMAP, JSON.stringify(attr))
  if(attr.segments.includes(0)) return false
  let fname = await autoRenameAsync(attr.userUUID, attr.dirUUID, attr.name)
  console.log('----------------' + fname)
  await moveFileMapAsync(attr.userUUID, attr.dirUUID, fname, fpath, attr.sha256)
  return true
}

const autoRename = (userUUID, dirUUID, filename, callback) => {
  config.ipc.call('list',{ userUUID, dirUUID }, (err, nodes) => {
    if(err) return callback(err)
    let files = nodes.map(n => n.name)
    if(!files.includes(filename)) return callback(null, filename)

    let filenameArr = filename.split('.')
    let fn , ftype = false
    if(filenameArr.length === 1) {
      fn = filename
    }else{
      ftype = filenameArr.pop()
      fn = filenameArr.join('.')
    }

    let count = 1
    let fname = fn + '[' + count + ']' + (ftype ? ('.' + ftype) : '')
    while(files.includes(fname)){
      count++
      fname = fn + '[' + count + ']' + (ftype ? ('.' + ftype) : '')
    }
    return callback(null, fname)
  })
}

const autoRenameAsync = (userUUID, dirUUID, filename) => Promise.promisify(autoRename)(userUUID, dirUUID, filename)

const moveFileMap = (userUUID, dirUUID, name, src, hash, callback) => {
  // config.ipc.call()
  let args = { userUUID, dirUUID, name, src, hash, check: false }
  config.ipc.call('createFile', args, (err, data) => {
    if(err) return callback(err)
    return callback(null, data)
  })
}

const moveFileMapAsync =  (userUUID, dirUUID, name, src, hash) =>  Promise.promisify(moveFileMap) (userUUID, dirUUID, name, src, hash)

const createFileMap = ({ size, segmentsize, dirUUID, sha256, name, userUUID}, callback) => 
  createFileMapAsync({ size, segmentsize, dirUUID, sha256, name, userUUID}).asCallback((e, data) => {
    e ? callback(e) : callback(null, data)
  })



export { createFileMap, SegmentUpdater, updateSegmentAsync, readFileMapList, readFileMap, deleteFileMap }