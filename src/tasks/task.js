const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

class Task {
}

/**
A DirCopy Task
*/
class DirCopyTask {

  constructor() {

    this.userUUID = userUUID
    this.type = 'DirCopy'

    this.src = dirUUID
    this.dst = dirUUID
  }
}

const DirWalk = dirPath => {

}

// input -> dirPath
// output -> dir object
async dirWalk = dirPath => {

  let entries = await fs.readdirAsync(dirPath)  
  let stats = Promise.map(entries, 
    async entry => {
      await fs.lstat(path.join(dirPath, entry))
    })
    .filter(x => !!x) 

  return {
    path: dirPath,
    entries: [
    
    ]
  }
}


