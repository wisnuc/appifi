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
    // attr = JSON.parse(await xattr.getAsync(target, FRUITMIX))
    let segments = []
    for(let i = 0; i < Math.ceil(size/segmentsize); i++){
      segments.push(0)
    }
    let attr = { size, segmentsize, segments, nodeuuid, sha256, name }
    await xattr.setAsync(filepath, FILEMAP, JSON.stringify(attr))
    return attr
  }catch(e){ throw e }
}

const updateSegmentsFile = ({ sha256, stream, start, useruuid }, callback) => {
  let folderPath = path.join(paths.get('filemap'), useruuid, sha256)
  fs.createReadStream()
}

export { creatSegmentsFile, updateSegmentsFile }