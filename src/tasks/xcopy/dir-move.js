const Dir = require('./dir-base')
const FileMove = require('./file-move')

class Working extends Dir.prototype.Working {

  enter () {
    super.enter()

    let src = { dir: this.ctx.src.uuid }
    let dst = { dir: this.ctx.parent.dst.uuid }
    let policy = this.ctx.getPolicy()

    this.ctx.ctx.mvdir(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        let [same, diff] = resolved 
        if (same === 'skip') { // this is acturally a merging, same with copy
          this.ctx.dst = { uuid: xstat.uuid, name: xstat.name }
          this.setState('Reading')
        } else {
          this.setState('Finished')
        }
      }
    })
  }

}

class Read extends Dir.prototype.Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let src = { uuid: fstat.uuid, name: fstat.name }
      let file = new FileMove(this.ctx.ctx, this.ctx, src)

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
      let src = { uuid: dstat.uuid, name: dstat.name }
      let dir = new DirMove(this.ctx.ctx, this.ctx, src)

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

class DirMove extends Dir { }

DirMove.prototype.Working = Working
DirMove.prototype.Reading = Dir.prototype.FruitReading
DirMove.prototype.Read = Read

module.exports = DirMove


