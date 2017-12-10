const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')

const File = require('./file-base')
const openwx = require('./lib').openwx

class Working extends File.prototype.Working {

  enter () {
    super.enter()

    let src = {
      dir: this.ctx.parent.srcUUID,
      uuid: this.ctx.src.uuid,
      name: this.ctx.src.name
    }

    this.ctx.ctx.clone(src, (err, tmpPath) => {
      if (err) {
        this.setState('Failed', err)
      } else {
        let dstFilePath = path.join(this.ctx.parent.dstPath, this.ctx.src.name)
        let policy = this.ctx.getPolicy()

        openwx(dstFilePath, policy, (err, fd) => {
          if (err) {
            rimraf(tmpPath, () => {})
            this.setState('Failed', err) 
          } else {
            this.rs = fs.createReadStream(tmpPath) 
            this.ws = fs.createWriteStream(null, { fd })
            this.rs.pipe(this.ws)

            this.ws.on('finish', () => {
              rimraf(tmpPath, () => {})
              this.setState('Finished')
            })
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

