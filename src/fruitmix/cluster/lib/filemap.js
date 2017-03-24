import path from 'path'
import fs from 'fs'
import child from 'child_process'

import xattr from 'fs-xattr'
import Promise from 'bluebird'

import  paths from './paths'
import HashTransform from '../lib/transform'

Promise.promisifyAll(child)
Promise.promisifyAll(xattr)

let FILEMAP = 'user.filemap'

const createFileMapAsync = async ({ size, segmentsize, nodeuuid, sha256, name, userUUID}) => {
  // fallocate -l 10G bigfile
  let folderPath = path.join(paths.get('filemap'), userUUID)
  try{
    await fs.mkdirAsync(folderPath)
    let filepath = path.join(folderPath, sha256)
    await child.execAsync('fallocate -l ' + size +' ' + filepath)
    // may throw xattr ENOENT or JSON SyntaxError
    let segments = []
    for(let i = 0; i < Math.ceil(size/segmentsize); i++){
      segments.push(0)
    }
    let attr = { size, segmentsize, segments, nodeuuid, sha256, name }
    await xattr.setAsync(filepath, FILEMAP, JSON.stringify(attr))
    return attr
  }catch(e){ throw e }
}

const updateFileMap = async ({ sha256, segmentHash, req , start, userUUID }, callback) => {
  let filePath = path.join(paths.get('filemap'), userUUID, sha256)
  let abort = false
  try{
    await fs.statAsync(filePath)
     
    let attr = JSON.parse(await xattr.getAsync(filePath, FILEMAP))

    let segments = attr.segments
    if(segments.length < start || segments[start] === 1)
      callback(null, false)

    let position = attr.segmentsize * start

    let writeStream =  fs.createWriteStream(filePath,{ flags: 'r+', start: position})
    
    let hashTransform = HashTransform()

    req.pipe(hashTransform)

    hashTransform.pipe(writeStream)

    hashTransform.on('error', err => {
      if(abort) return
      abort = true 
      return callback(err)
    })

    writeStream.on('error', err =>{ 
      if(abort) return 
      abort = true
      return callback(err)
     })

    req.on('error', err => {
      if(abort) return 
      abort = true
      return callback(err)
    })
    
    writeStream.on('finish', async () => {
      if(abort) return 
      try{
        if(hashTransform.getHash() !== segmentHash)
          return callback(null, false)        
        let attr = JSON.parse(await xattr.getAsync(filePath, FILEMAP))
        attr.segments[start] = 1
        await xattr.setAsync(filepath, FILEMAP, JSON.stringify(attr))
        return callback(null, true) 
      }catch(e){ 
        if(abort) return 
        abort = true
        return callback(e) 
      }        
    })

  }catch(e){
     if(abort) return 
      abort = true
      return callback(e) 
   }

}

const createFileMap = ({ size, segmentsize, nodeuuid, sha256, name, userUUID}, callback) => 
  createFileMapAsync({ size, segmentsize, nodeuuid, sha256, name, userUUID}).asCallback((e, data) => {
    e ? callback(e) : callback(null, data)
  })


export { createFileMap, updateFileMap }