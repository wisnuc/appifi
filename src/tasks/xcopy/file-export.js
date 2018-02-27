const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')

const File = require('./file-base')
const openwx = require('./lib').openwx

class Working extends File.prototype.Working {

  enter () {
    super.enter()

    let src = {
      dir: this.ctx.parent.src.uuid,
      uuid: this.ctx.src.uuid,
      name: this.ctx.src.name
    }

    this.ctx.ctx.clone(src, (err, tmpPath) => {
      if (err) {
        this.setState('Failed', err)
      } else {
        let dstFilePath = path.join(this.ctx.parent.dst.path, this.ctx.src.name)
        let policy = this.ctx.getPolicy()

        openwx(dstFilePath, policy, (err, fd, resolved) => {
          if (err && err.code === 'EEXIST') {
            rimraf(tmpPath, () => {})
            this.setState('Conflict', err, policy) 
          } else if (err) {
            rimraf(tmpPath, () => {})
            this.setState('Failed', err)
          } else {
            if (fd) {
              this.rs = fs.createReadStream(tmpPath) 
              this.ws = fs.createWriteStream(null, { fd })
              this.rs.pipe(this.ws)

              this.ws.on('finish', () => {
                rimraf(tmpPath, () => {})
                this.setState('Finished')
              })
            } else {
              this.setState('Finished')
            }
          }
        })
      }
    })
  }
}

/**
@extends XCopy.File
@memberof XCopy
*/
class FileExport extends File { }

FileExport.prototype.Working = Working

module.exports = FileExport

