const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

const { mkdir } = require('./lib')

const Node = require('./node')
const State = require('./state')

const { File, FileCopy, FileMove, FileImport, FileExport } = require('./file')


class FruitReading extends Reading {

  enter () {
    super.enter()
    // readdir always read source dir
    this.ctx.ctx.readdir(this.ctx.srcUUID, (err, xstats) => {
      if (err) {
        this.setState('Failed', err)
      } else {
        this.setState('Read', xstats)
      }
    })
  }

}

class NativeReading extends Reading {

  enter () {
    super.enter()

    let srcPath = this.ctx.srcPath
    fs.readdir(this.ctx.srcPath, (err, files) => {
      if (err) {
        this.setState('Failed', err)
      } else if (files.length === 0) {
          this.setState('Read', [])
      } else {
        let count = files.length
        let stats = []
        files.forEach(file => {
          fs.lstat(path.join(srcPath, file), (err, stat) => {
            if (!err && (stat.isDirectory() || stat.isFile())) {
              let x = { 
                type: stat.isDirectory() ? 'directory' : 'file',
                name: file
              }

              if (x.type === 'file') {
                x.size = stat.size
                x.mtime = stat.mtime.getTime()
              }
              
              stats.push(x)
            } 

            if (!--count) {
              this.setState('Read', stats)
            }
          })
        })
      }
    })
  }

}

module.exports = {
  Dir: require('./dir-base'),
  DirCopy: require('./dir-copy'),
  DirMove: require('./dir-move'),
  DirImport: require('./dir-import'),
  DirExport: require('./dir-export')
}

