const pretty = require('prettysize')

import command from '../lib/command'
import hash from './hash'
import identify from './identify'
import Node from './node'

class FileNode extends Node {

  // create file node
  constructor(ctx, xstat) {
    super(ctx)
    this.uuid = xstat.uuid
    this.name = xstat.name 
    this.mtime = xstat.mtime
    this.size = xstat.size
    this.magic = xstat.magic
    this.hash = xstat.hash
  }

  identify() {
    this.worker = this.createIdentifyWorker(() => {
      this.worker = null
      if (err) return // TODO:
      this.ctx.emit('mediaIdentified', this, metadata)
    })
  }

  // before update
  updating(xstat) {
    this.abort()
    if (this.magic && this.hash) {                  // already appeared
      if (!xstat.magic || xstat.hash !== this.hash) // not media or hash changed
        this.ctx.emit('mediaDisappearing', this)
    }
  }

  // after update
  updated() {

    if (typeof this.magic !== 'string') return

    if (this.hash && this.magic) 
      this.ctx.emit('mediaAppeared', this)
    else {
      this.worker = hash(this.abspath(), this.uuid)
      this.worker.on('error', err => {
        this.worker = null
        this.ctx.hashStopped(this)
      })

      this.worker.on('finish', xstat => {
        this.worker = null
        this.ctx.hashStopped(this)
        this.update(xstat)
      })

      this.worker.start()
    }
  }

  // attach
  attach(parent) {
    super.attach(parent)
    this.updated()
  }

  update(xstat) {

    if ( this.name === xstat.name
      && this.mtime === xstat.mtime
      && this.size === xstat.size
      && this.magic === xstat.magic
      && this.hash === xstat.hash)
      return

    this.updating(xstat)

    this.name = xstat.name
    this.mtime = xstat.mtime
    this.size = xstat.size
    this.magic = xstat.magic
    this.hash = xstat.hash

    this.updated()
  }

  detach() {
    this.abort()
    if (this.magic && this.hash)      
      this.ctx.emit('mediaDisappearing', this)
    super.detach()
  }

  isFile() {
    return true
  }

  genObject() {
    return pretty(this.size) + ' ' + (this.hash ? this.hash.slice(0, 8) : '')
  }
}

export default FileNode
