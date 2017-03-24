import path from 'path'
import fs from 'fs'
import child from 'child_process'

import xattr from 'fs-xattr'

import  paths from './paths'

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

const updateFileMapAsync = async ({ sha256, form , start, userUUID }) => {
  let filePath = path.join(paths.get('filemap'), userUUID, sha256)
  try{
    await fs.statAsync(filePath)
    
    let attr = JSON.parse(await xattr.getAsync(filePath, FILEMAP))

    let segments = attr.segments
    if(segments.length < start || segments[start] === 1)
      return false

    let position = attr.segmentsize * start

    let writeStream =  await fs.createWriteStream(filePath,{ flags: 'r+', start: position})
    
    form.stream.pipe(writeStream)

    writeStream.on('error', err =>{ return false })

    form.stream.on('error', err => { return false })
    
    writeStream.on('finish', () => {
        try{
          let attr = JSON.parse(await xattr.getAsync(filePath, FILEMAP))
          attr.segments[start] = 1
          await xattr.setAsync(filepath, FILEMAP, JSON.stringify(attr))
          return true 
        }catch(e){ return false }        
    })

  }catch(e){ return false }

}

const createFileMap = ({ size, segmentsize, nodeuuid, sha256, name, useruuid}, callback) => {
  createFileMapAsync({ size, segmentsize, nodeuuid, sha256, name, useruuid}).asCallback((e, data) => {
    e ? callback(e) : callback(null, data)
  })
}

const updateFileMap = ({ sha256, form , start, useruuid }, callback) => 
  updateFileMapAsync({ sha256, form , start, useruuid }).asCallback((e,data) => 
    e ? callback(e) : callback(null, data))


export { createFileMap, updateFileMap }