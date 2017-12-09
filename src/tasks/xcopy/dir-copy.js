const Directory = require('./dir-base')

class Working extends Directory.Working {
  
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

class Read extends Directory.Read {

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
      let dir = new CopyDirectory(this.ctx.ctx, this.ctx, dstat.uuid)
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

  next () {
    let name = this.entries.shift()
    fs.lstat(
  }
}


class DirCopy extends Directory {

  constructor(ctx, parent, srcUUID, dstUUID, xstats) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    if (dstUUID) {
      this.dstUUID = dstUUID
      new CopyRead(this, xstats)
    } else {
      new Pending(this)
    }
  } 
}

DirCopy.prototype.Working = Working
DirCopy.prototype.Read = Read

module.exports = DirCopy


