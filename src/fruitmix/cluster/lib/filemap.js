import path from 'path'
import fs from 'fs'
import child from 'child_process'

import xattr from 'fs-xattr'

import  paths from './paths'

Promise.promisifyAll(child)
Promise.promisifyAll(xattr)

let FILEMAP = 'user.filemap'

const creatSegmentsFileAsync = async ({ size, segmentsize, nodeuuid, sha256, name, useruuid}) => {
  // fallocate -l 10G bigfile
  let folderPath = path.join(paths.get('filemap'), useruuid)
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

const updateSegmentsFileAsync = async ({ sha256, form , start, useruuid }) => {
  let filePath = path.join(paths.get('filemap'), useruuid, sha256)
  try{
    await fs.statAsync(filePath)
    
    let writeStream =  await fs.createWriteStream(filePath,{ flags: 'r+', start})
    
    form.stream.pipe(writeStream)

    writeStream.on('error', err =>{ return false })

    form.stream.on('error', err => { return false })
    
    writeStream.on('finish', () => { return true })

  }catch(e){ return false }

}

const creatSegmentsFile = ({ size, segmentsize, nodeuuid, sha256, name, useruuid}, callback) => {
  creatSegmentsFileAsync({ size, segmentsize, nodeuuid, sha256, name, useruuid}).asCallback((e, data) => {
    e ? callback(e) : callback(null, data)
  })
}

const updateSegmentsFile = ({ sha256, form , start, useruuid }, callback) => 
  updateSegmentsFileAsync({ sha256, form , start, useruuid }).asCallback((e,data) => 
    e ? callback(e) : callback(null, data))


export { creatSegmentsFile, updateSegmentsFile }