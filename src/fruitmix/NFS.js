const EventEmitter = require('events')

const { isUUID, isNonNullObject } = require('../lib/assertion')

/**
NFS provides native file system access to users.

@requires User 
@module NFS
*/


/**

*/
class NFS extends EventEmitter {

  /**
  Create a NFS module

  @param {object} opts
  @param {object} volumeUUID
  @param {object} opts.allowATA 
  @param {object} opts.allowUSB
  */
  constructor (opts, user) {
    super()

    if (!isNonNullObject(opts)) throw new Error('opts must be a non-null object')
    if (!isUUID(opts.volumeUUID)) throw new Error('volumeUUID is not a valid uuid')

    this.volumeUUID = opts.volumeUUID
    this.allowATA = false
    this.allowUSB = true

    /**
    a drive is acturally a file system that:
    1. can be a volume, a standalone disk, or a partition
    */
    this.drives = []
  }

  update (storage) {

    let { blocks, volumes } = storage

    let vols = volumes.filter(vol => {
      if (vol.isMissing) return false
      if (!vol.isMounted) return false
      if (vol.isRootFS) return false
      if (vol.uuid === this.volumeUUID) return false
      return true
    })

    let blks = blocks.filter(blk => {
      if (!blk.isFileSystem) return false
      if (blk.isVolumeDevice) return false
      if (blk.isRootFS) return false
      if (!blk.isMounted) return false
      return !!(blk.isNtfs || blk.isVfat || blk.isExt4)
    })

    this.drives = [...vols, ...blks]
  }

  /**
  readdir, path must be URI encoded string

  @param {object} user
  @param {object} props
  @param {string} props.path - relative path URI encoded
  */
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

