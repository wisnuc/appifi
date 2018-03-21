const File = require('./file-base')

class Working extends File.prototype.Working {

  enter () {
    super.enter()
    let src = {
      dir: this.ctx.parent.src.uuid,
      uuid: this.ctx.src.uuid,
      name: this.ctx.src.name
    }

    let dst = {
      dir: this.ctx.parent.dst.uuid
    }

    let policy = this.ctx.getPolicy()
    this.ctx.ctx.cpfile(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        if (!this.ctx.isDestroyed()) this.setState('Finished')
      }
    })
  }

}

/**
@extends XCopy.File
@memberof XCopy
*/
class FileCopy extends File {}

FileCopy.prototype.Working = Working

module.exports = FileCopy
