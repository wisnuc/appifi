const path = require('path')
const fs = require('fs')

const UUID = require('uuid')

const FileImport = require('./file-import')
const Dir = require('./dir-base')

/**
Working state for DirImport

@memeberof XCopy.DirImport
*/
class Working extends Dir.prototype.Working {

/**
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
**/

  mkdir (policy, callback) {
    let dst = {
      dir: this.ctx.parent.dst.uuid,
      name: this.ctx.src.name,
    }

    this.ctx.ctx.mkdir(dst, policy, (err, xstat, resolved) => {
      if (err) {
        callback(err)
      } else {
        if (!xstat) return callback(null, null, resolved)
        let dst2 = { uuid: xstat.uuid, name: xstat.name }
        callback(null, dst2, resolved)
      }
    })
  }
}

/**
Reading state for DirImport

@memberof XCopy.DirImport
*/
class Reading extends Dir.prototype.Reading {

  /**
  Returns stats of source directory

  @override
  */
  read (callback) {
    let srcPath = this.ctx.src.path
    fs.readdir(srcPath, (err, files) => {
      if (err) return callback(err)
      if (files.length === 0) return callback(null, [])
      let count = files.length
      let stats = []
      files.forEach(file => {
        fs.lstat(path.join(srcPath, file), (err, stat) => {
          if (!err && (stat.isDirectory() || stat.isFile())) {
            if (stat.isDirectory()) {
              stats.push({
                type: 'directory',
                name: file
              })
            } else {
              stats.push({
                type: 'file',
                name: file,
                size: stat.size,
                mtime: stat.mtime.getTime()
              })
            }
          }

          if (!--count) callback(null, stats)
        })
      })
    })
  }

}

/**
Directory sub-task for import.

@memberof XCopy
@extends XCopy.Dir
*/
class DirImport extends Dir { 

  /**
  Returns subtask from native file system stat 

  @override
  */
  createSubTask (stat) {
    let src = {
      uuid: UUID.v4(),
      name: stat.name,
      path: path.join(this.src.path, stat.name)
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

