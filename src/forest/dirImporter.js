const Promise = require('bluebird')
const path = require('path')
const fs = Promise.all(require('fs'))


const DirWalker = require('./dirWalker') 

class DirImporter {

  constructor(src, dst, tmp) {

    let dirs = []
    let walker = new DirWalker(src)
    walker.on('data', dirs.push(data))
    walker.on('finish', this.walkerFinished = true)

        
  }

  schedule () {
    
  }
}

