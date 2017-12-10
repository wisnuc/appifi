const Dir = require('./dir-base')
const FileMove = require('./file-move')

class Working extends Dir.prototype.Working {

  enter () {
    super.enter()
    let src = { dir: this.ctx.src.uuid }
    let dst = { dir: this.ctx.parent.dst.uuid }
    let policy = this.ctx.getPolicy()
    this.ctx.ctx.mvdir(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        let [same, diff] = resolved 
        if (same === 'skip') { // this is a merge, same with copy
          this.ctx.dst = { uuid: xstat.uuid, name: xstat.name }
          this.setState('Reading')
        } else {
          this.setState('Finished')
        }
      }
    })
  }

}

class DirMove extends Dir { }

DirMove.prototype.Working = Working
DirMove.File = FileMove

module.exports = DirMove


