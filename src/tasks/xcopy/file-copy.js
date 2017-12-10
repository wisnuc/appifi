const File = require('./file-base')

class Working extends File.prototype.Working {

  enter () {
    super.enter()

    let src = {
      dir: this.ctx.parent.srcUUID,
      uuid: this.ctx.srcUUID,
      name: this.ctx.srcName,
    }

    let dst = {
      dir: this.ctx.parent.dstUUID
    }

    let policy = this.ctx.getPolicy()

    this.ctx.ctx.cpfile(src, dst, policy, (err, xstat, resolved) => {
      // the following setState works for they are not overridden
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
class FileCopy extends File {

  constructor(ctx, parent, srcUUID, srcName) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
    this.state = new this.Pending(this)
  }

}

FileCopy.prototype.Working = Working

module.exports = FileCopy



