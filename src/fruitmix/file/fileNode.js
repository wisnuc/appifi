import command from '../lib/command'
import hash from './hash'
import identify from './identify'
import Node from './node'

class FileNode extends Node {

  // create file node
  constructor(ctx, props) {
    super(ctx)
      this.worker = createHashWorker((err, xstat) => {
        this.worker = null
        if (err) return // TODO
        this.update(props)
      }) 
  }

  // attach
  attach(parent) {
    super.attach(parent)
    this.updated()
  }

  update(props) {

    if ( this.name === props.name
      && this.mtime === props.mtime
      && this.size === props.size
      && this.magic === props.magic
      && this.hash === props.hash)
      return

    this.updating(props)

    this.name = props.name
    this.mtime = props.mtime
    this.size = props.size
    this.magic = props.magic
    this.hash = props.hash

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
  
}

export default FileNode
