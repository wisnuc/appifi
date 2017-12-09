class ImportWorking extends Working {

  enter () {
    super.enter()

    let dst = {
      dir: this.ctx.parent.dstUUID,
      name: this.ctx.srcName,
    }

    let policy = this.ctx.getPolicy()
   
    this.ctx.ctx.mkdir(dst, policy, (err, xstat, resolved) => {
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

class ImportRead extends Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileImport(this.ctx.ctx, this.ctx, path.join(this.ctx.srcPath, fstat.name))

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
      let dir = new ImportDirectory(this.ctx.ctx, this.ctx, path.join(this.ctx.srcPath, dstat.name))

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

class DirImport extends Directory {
  
  constructor(ctx, parent, srcPath, dstUUID, stats) {
    super(ctx, parent)
    this.srcPath = srcPath
    this.srcName = path.basename(srcPath)

    if (dstUUID) {
      this.dstUUID = dstUUID
      new ImportRead(this, stats)
    } else {
      new Pending(this)
    }
  }

  identity () {
    return this.srcPath
  }
}

DirImport.prototype.Working = ImportWorking
DirImport.prototype.Reading = NativeReading
DirImport.prototype.Read = ImportRead

module.exports = DirImport

