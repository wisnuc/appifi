import { FILE } from '../lib/const'
import probe from './probe'
import Node from './node'
import FileNode from './fileNode'

class DirectoryNode extends Node {

  constructor(ctx, xstat) {
    super(ctx)
    this.uuid = xstat.uuid
    this.name = xstat.name
    this.mtime = FILE.NULLTIME
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

    let dpath = this.abspath()
    let uuid = this.uuid
    let mtime = this.mtime
    let delay = mtime === FILE.NULLTIME ? 0 : 500

    this.ctx.probeStarted(this) // audit
    this.worker = probe(dpath, uuid, mtime, delay)

    this.worker.on('error', (err, again) => {
      this.worker = null
      this.ctx.probeStopped(this) // audit
      if (err.code === 'EABORT') return
      this.parent.probe()
    })

    this.worker.on('finish', (data, again) => {
      this.worker = null
      this.ctx.probeStopped(this) // audit
      if (this.data) thie.merge(data.mtime, data.xstats)
      if (again) this.probe()
    })
  }

  attach(parent) {
    super.attach(parent) 
    this.probe()
  }

  update(xstat) {
    this.name = xstat.name   
    if (this.mtime !== xstat.mtime) this.probe()
  }

  detach() {
    [...this.getChildren()].forEach(c => c.detach())
    this.abort()
    super.detach()
  }

  isDirectory() {
    return true
  }

}

export default DirectoryNode
