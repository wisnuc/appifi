const path = require('path')

const Dir = require('./dir-base')
const FileExport = require('./file-export')
const mkdir = require('./lib').mkdir

class Working extends Dir.prototype.Working {

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

class Read extends Dir.prototype.Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileExport(this.ctx.ctx, this.ctx, {
        uuid: fstat.uuid, 
        name: fstat.name
      })

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
      let dir = new DirExport(this.ctx.ctx, this.ctx, dstat.uuid, dstat.name)
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

class DirExport extends Dir {

  constructor(ctx, parent, srcUUID, srcName, dstPath, xstats) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
    if (dstPath) {
      this.dstPath = dstPath
      new this.Read(this, xstats)
    } else {
      new this.Pending(this)
    }
  }
}

DirExport.prototype.Working = Working
DirExport.prototype.Reading = Dir.prototype.FruitReading
DirExport.prototype.Read = Read

module.exports = DirExport
