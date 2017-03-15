import { FILE } from './lib/const'
import probe from './probe'
import Node from './node'
import FileNode from './fileNode'

class DirectoryNode extends Node {

  constructor(ctx, props) {
    super(ctx)
    this.uuid = props.uuid
    this.name = props.name
    this.mtime = FILE.MTIME
  }

  merge(mtime, xstats) {

    let map = new Map(xstats.map(x => [x.uuid, x]))
    let children = this.getChildren()

    let lost = []
    children.forEach(c => {
      let xstat = map.get(c.uuid)
      if (!xstat) return lost.push(c)
      c.update(xstat)
      map.delete(c.uuid)
    })

    lost.forEach(l => l.detach())

    // found
    map.forEach(xstat => {

      let node = xstat.type === 'directory' 
        ? new DirectoryNode(this.ctx, xstat)
        : xstat.type === 'file' 
          ? new FileNode(this.ctx, xstat)
          : undefined
        
      node && node.attach(this)
    })

    this.mtime = mtime 
  }

  probe() {

    if (this.worker) return this.worker.request()

    let delay = this.mtime === FILE.MTIME ? 0 : 500
    let dpath = this.abspath()
    let uuid = this.uuid

    // audit
    this.ctx.probeCountInc()

    this.worker = probe(dpath, uuid, delay, (err, result) => { 

      // audit
      this.ctx.decProbeCount()

      // !!! important
      this.worker = null

      if (err) {
        if (err.code === 'EABORT') return
        this.parent 
          ? this.parent.probe()
          : this.probe()
      }
      else {
        let { mtime, xstats, again } = result
        this.merge(mtime, xstats) 
        if (again) this.probe()                
      }
    })
  }

  attach(parent) {
    super.attach(parent) 
    this.probe()
  }

  update(xstat) {
    this.name = xstat.name   
    if (this.mtime !== xstat.mtime)
      this.probe()
  }

  detach() {
    [...this.getChildren()].forEach(c => c.detach())
    this.abort()
    super.detach()
  }
}

export default DirectoryNode
