import path from 'path'
import fs from 'fs'
import child from 'child_process'

import  paths from './paths'

const creatSegmentsFileAsync = async ({ size, segmentsize, nodeuuid, sha256, name, useruuid} , callback) => {
  // fallocate -l 10G bigfile
  let folderPath = path.join(paths.get('filemap'), useruuid)
  try{
    await fs.mkdirAsync(folderPath)
  }catch(e){ callback(e) }
  let filepath = path.join(folderPath, sha256)
  child.exec('fallocate -l ' + size +' ' + filepath)

  
}

const updateSegmentsFile = ({ sha256, stream, start }, callback) => {

}

export { creatSegmentsFile, updateSegmentsFile }