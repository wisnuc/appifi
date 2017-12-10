const path = require('path')
const fs = require('fs')

const UUID = require('uuid')

const FileImport = require('./file-import')
const Dir = require('./dir-base')

class Working extends Dir.prototype.Working {

  enter () {
    super.enter()
    let dst = {
      dir: this.ctx.parent.dst.uuid,
      name: this.ctx.src.name,
    }

    let policy = this.ctx.getPolicy()
   
    this.ctx.ctx.mkdir(dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dst = {
          uuid: xstat.uuid,
          name: xstat.name 
        }
        this.setState('Reading')
      }
    })
  }

}

// Native File System
class Reading extends Dir.prototype.Reading {

  read () {
    let srcPath = this.ctx.src.path
    fs.readdir(srcPath, (err, files) => {
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

class DirImport extends Dir { 

  // override base method
  createSubTask (stat) {
    let src = {
      uuid: UUID.v4(),
      name: stat.name,
      path: path.join(this.ctx.src.path, stat.name)
    }

    if (stat.type === 'directory') {
      return new DirImport(this.ctx, this, src)
    } else {
      return new FileImport(this.ctx, this, src)
    }
  }

}

DirImport.prototype.Working = Working
DirImport.prototype.Reading = Reading
DirImport.File = FileImport

module.exports = DirImport

