import probe from './probe'
import Node from './node'

class DirectoryNode extends Node {

  constructor(ctx, props) {
    super(ctx)
    
    this.uuid = props.uuid
    this.name = props.name
    this.mtime = -1
  }

  abort() {
    if (this.probe) {
      this.probe.abort()
      this.worker = null
    }
  }

  updating(props) {
    this.abort()
  }

  updated() {
  }

  requestProbe() {

    if (this.probe) return this.probe.request()

    this.probe = probe((err, { mtime, props, again }) => { 

      this.probe = null
      if (err && err.code === 'EABORT')       
        return

      // FIXME a lot of possible error should be considered          

      // merge props and update mtime 
      
      if (again) { // schedule another one
                
      }
    })
  }

  attach() {
    
  }
}
