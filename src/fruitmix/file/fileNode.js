import command from './lib/command'
import hash from './hash'
import identify from './identify'
import Node from './node'

const createFileNodeClass = () => 
  class FileNode extends Node {

    // create file node
    constructor(parent, props) {
      super(parent)

      this.uuid = props.uuid
      this.name = props.name 
      this.mtime = props.mtime
      this.size = props.size
      this.magic = props.magic
      this.hash = props.hash
      this.worker = null
    }

    // abort workers
    abort() {
      if (this.worker) {
        this.worker.abort()
        this.worker = null
      }
    }

    // before update
    updating(props) {
      this.abort()
      if ((this.magic && this.hash) 
        && !(props.magic && props.hash))
        this.ctx.emit('mediaDisappearing', this)
    }

    // after update
    updated() {
      if (!this.magic) return
      if (this.hash && this.magic) 
        this.ctx.emit('mediaAppeared', this)
      else
        this.worker = createHashWorker((err, xstat) => {
          this.worker = null
          if (err) return // TODO
          this.update(props)
        }) 
    }

    // attach
    attach() {
      this.updated()
    }

    update(props) {

      if ( this.name === props.name
        && this.mtime === props.mtime
        && this.size === props.size
        && this.magic === props.magic
        && this.hash === props.hash)
        return false

      this.updating(props)

      this.name = props.name
      this.mtime = props.mtime
      this.size = props.size
      this.magic = props.magic
      this.hash = props.hash

      this.updated()

      return true
    }

    detach() {
      this.abort()
      if (this.type && this.hash)      
        this.ctx.emit('mediaDisappearing', this)
    }

    identify() {
      this.worker = this.createIdentifyWorker(() => {
        this.worker = null
        if (err) return // TODO 
        this.ctx.emit('metadata', meta)
      })
    }
  }



