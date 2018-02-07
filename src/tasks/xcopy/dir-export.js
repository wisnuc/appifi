const path = require('path')

const Dir = require('./dir-base')
const FileExport = require('./file-export')
const mkdir = require('./lib').mkdir

class Working extends Dir.prototype.Working {

/**
  enter () {
    super.enter()
    let dstPath = path.join(this.ctx.parent.dst.path, this.ctx.src.name)
    let policy = this.ctx.getPolicy()
    mkdir(dstPath, policy, (err, _, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dst = {
          name: this.ctx.src.name,
          path: dstPath,
        }
        this.setState('Reading')
      } 
    })
  }
**/

  mkdir (policy, callback) {
    let name = this.ctx.src.name
    let dstPath = path.join(this.ctx.parent.dst.path, name)
    mkdir(dstPath, policy, (err, dst, resolved) => {
      if (err) {
        callback(err)
      } else {
        let dst2 = {
          name: this.ctx.src.name,
          path: dst || dstPath
        }
        callback(null, dst2, resolved)
      }
    }) 
  }
}

class DirExport extends Dir { }

DirExport.prototype.Working = Working
DirExport.File = FileExport

module.exports = DirExport
