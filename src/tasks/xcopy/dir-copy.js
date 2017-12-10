const Dir = require('./dir-base')
const FileCopy = require('./file-copy')

class Working extends Dir.prototype.Working {
  
  enter () {
    super.enter()
    let src = { dir: this.ctx.src.uuid }
    let dst = { dir: this.ctx.parent.dst.uuid }
    let policy = this.ctx.getPolicy()
    this.ctx.ctx.cpdir(src, dst, policy, (err, xstat) => {
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


class DirCopy extends Dir { }

DirCopy.prototype.Working = Working
DirCopy.File = FileCopy

module.exports = DirCopy


