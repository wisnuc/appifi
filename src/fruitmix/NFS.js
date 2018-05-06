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
  @param {object} boundVolume
  @param {object} opts.allowATA 
  @param {object} opts.allowUSB
  */
  constructor (opts, user) {
    super()
    this.allowATA = false
    this.allowUSB = true

    /**
    a drive is acturally a file system that:
    1. can be a volume, a standalone disk, or a partition
    */
    this.drives = []
  }

  update (storage) {
 
  }

  LIST (user, props, callback) {
  }

  GET (user, props, callback) {
  }    

  POSTFORM (user, props, callback) {
  } 

  PATCH (user, props, callback) {
  }

  PUT (user, props, callback) {
  }

  DELETE (user, props, callback) {
  }
}

module.exports = NFS

