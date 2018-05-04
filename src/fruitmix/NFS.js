const EventEmitter = require('events')

/**
NFS provides native file system access to users.

@requires User 
@module NFS
*/

class NFS extends EventEmitter {

  /**
  Create a NFS module

  @param {object} opts
  @param {object} opts.allowATA 
  @param {object} opts.allowUSB
  */
  constructor (opts, user) {
    super()
    this.allowATA = false
    this.allowUSB = true
    this.drives = []
  }

  update (storage) {
    
  }

  
}

module.exports = NFS

