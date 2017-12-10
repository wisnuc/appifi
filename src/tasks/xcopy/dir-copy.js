const Dir = require('./dir-base')
const FileCopy = require('./file-copy')

class Working extends Dir.prototype.Working {
  
  enter () {
    super.enter()

    let src = { dir: this.ctx.srcUUID }
    let dst = { dir: this.ctx.parent.dstUUID }
    let policy = this.ctx.getPolicy()

    this.ctx.ctx.cpdir(src, dst, policy, (err, xstat) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dstUUID = xstat.uuid
        this.setState('Reading')
      }
    })
  }

}

class Read extends Dir.prototype.Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileCopy(this.ctx.ctx, this.ctx, fstat.uuid, fstat.name)
      file.on('error', err => { 
        // TODO
        this.next()
      })

      file.on('finish', () => {
        file.destroy(true)
        this.next()
      })

      return
    }

    if (this.ctx.dstats.length) {
      let dstat = this.ctx.dstats.shift()
      let dir = new DirCopy(this.ctx.ctx, this.ctx, dstat.uuid)
      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.ctx.children.length === 0) {
      this.setState('Finished')
    }
  }

}


class DirCopy extends Dir {

  constructor(ctx, parent, srcUUID, dstUUID, xstats) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    if (dstUUID) {
      this.dstUUID = dstUUID
      new this.Read(this, xstats)
    } else {
      new this.Pending(this)
    }
  } 
}

DirCopy.prototype.Working = Working
DirCopy.prototype.Reading = Dir.prototype.FruitReading
DirCopy.prototype.Read = Read

module.exports = DirCopy


