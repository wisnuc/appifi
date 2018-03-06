const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')

const File = require('./file-base')

class Working extends File.prototype.Working {

  enter () {
    super.enter()

    let tmpPath = this.ctx.ctx.genTmpPath()  
    fs.open(this.ctx.src.path, 'r', (err, fd) => {
      if (err) {
        // TODO
      } else {
        this.rs = fs.createReadStream(null, { fd })
        this.ws = fs.createWriteStream(tmpPath)
        this.rs.pipe(this.ws)
        this.ws.on('finish', () => {
       
          let tmp = { path: tmpPath }
          let dst = { 
            dir: this.ctx.parent.dst.uuid,
            name: this.ctx.src.name
          }

          let policy = this.ctx.getPolicy()

          this.ctx.ctx.mkfile(tmp, dst, policy, (err, xstat, resolved) => {
            if (err && err.code === 'EEXIST') {
              this.setState('Conflict', err, policy)
            } else if (err) {
              this.setState('Failed', err)
            } else {
              rimraf(tmpPath, () => {})
              this.setState('Finished')
            }
          })
        })
      }
    })
  }
}


/**
@extends XCopy.File
@memberof XCopy
*/
class FileImport extends File { }

FileImport.prototype.Working = Working

module.exports = FileImport


