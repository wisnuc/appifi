const File = require('./file-base')

class Working extends File.prototype.Working {

  enter () {
    super.enter()
/**
    let src = {
      dir: this.ctx.parent.srcUUID,
      uuid: this.ctx.srcUUID,
      name: this.ctx.srcName,
    }
**/
    let src = {
      dir: this.ctx.parent.srcUUID,
      uuid: this.ctx.src.uuid,
      name: this.ctx.src.name
    }

    let dst = {
      dir: this.ctx.parent.dstUUID
    }

    let policy = this.ctx.getPolicy()

    this.ctx.ctx.mvfile(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setStaate('Failed', err)
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
/**
  constructor(ctx, parent, srcUUID, srcName) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
    this.state = new this.Pending(this)
  }
**/

FileMove.prototype.Working = Working

module.exports = FileMove


