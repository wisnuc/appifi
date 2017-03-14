const Node = require('./node')

class DirectoryNode extends Node {

  constructor(props) {
    
    this.probe = null  
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
}
