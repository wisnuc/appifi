const path = require('path')

const Dir = require('./dir-base')
const FileExport = require('./file-export')
const mkdir = require('./lib').mkdir

class Working extends Dir.prototype.Working {

  enter () {
    super.enter()

    let dstPath = path.join(this.ctx.parent.dst.path, this.ctx.src.name)
    let policy = this.ctx.getPolicy()

    mkdir(dstPath, policy, (err, _, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dst = {
          name: this.ctx.src.name,
          path: dstPath,
        }

        this.setState('Reading')
      } 
    })
  }

}

class Read extends Dir.prototype.Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let src = { uuid: fstat.uuid, name: fstat.name }
      let file = new FileExport(this.ctx.ctx, this.ctx, src)

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
      let src = { uuid: dstat.uuid, name: dstat.name }
      let dir = new DirExport(this.ctx.ctx, this.ctx, src)
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

class DirExport extends Dir { }

DirExport.prototype.Working = Working
DirExport.prototype.Reading = Dir.prototype.FruitReading
DirExport.prototype.Read = Read

module.exports = DirExport
