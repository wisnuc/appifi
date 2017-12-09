class ExportWorking extends Working {

  enter () {
    super.enter()

    let dstPath = path.join(this.ctx.parent.dstPath, this.ctx.srcName)
    let policy = this.ctx.getPolicy()

    mkdir(dstPath, policy, (err, _, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dstPath = dstPath
        this.setState('Reading')
      } 
    })
  }

}

class ExportRead extends Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileExport(this.ctx.ctx, this.ctx, fstat.uuid, fstat.name)

      file.on('error', err => { 
        // TODO
        console.log(err)
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
      let dir = new ExportDirectory(this.ctx.ctx, this.ctx, dstat.uuid, dstat.name)
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

class ExportDirectory extends Directory {

  constructor(ctx, parent, srcUUID, srcName, dstPath, xstats) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
    if (dstPath) {
      this.dstPath = dstPath
      new ExportRead(this, xstats)
    } else {
      new Pending(this)
    }
  }
}

ExportDirectory.prototype.Working = ExportWorking
ExportDirectory.prototype.Read = ExportRead

module.exports = DirExport
