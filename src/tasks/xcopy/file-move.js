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

    this.ctx.ctx.mvfile(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.setState('Finished')
      }
    })
  }

}

/**
@extends XCopy.File
@memberof XCopy
*/
class FileMove extends File { }

FileMove.prototype.Working = Working

module.exports = FileMove


