const Directory = require('./dir-base')

class Working extends Directory.Working {

  enter () {
    super.enter()

    let src = { dir: this.ctx.srcUUID }
    let dst = { dir: this.ctx.parent.dstUUID }
    let policy = this.ctx.getPolicy()

    this.ctx.ctx.mvdir(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        let [same, diff] = resolved 
        if (same === 'skip') { // this is acturally a merging, same with copy
          this.ctx.dstUUID = xstat.uuid 
          this.setState('Reading')
        } else {
          this.setState('Finished')
        }
      }
    })
  }

}

class Read extends Directory.Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileMove(this.ctx.ctx, this.ctx, fstat.uuid, fstat.name)

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
      let dir = new MoveDirectory(this.ctx.ctx, this.ctx, dstat.uuid)
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

class DirMove extends Directory {

  constructor(ctx, parent, srcUUID, dstUUID, xstats) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    if (dstUUID) {
      this.dstUUID = dstUUID
      new MoveRead(this, xstats)
    } else {
      new Pending(this)
    }
  }
}

DirMove.prototype.Working = MoveWorking
DirMove.prototype.Read = MoveRead

module.exports = DirMove


