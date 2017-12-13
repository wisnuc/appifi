
const hostfsapi = {

  storage: null,

  setStorage (storage) {
    this.storage = storage
  }

  /**
  Returns file systems

  */
  getFileSystems () {
    if (!this.storage) return []  
    let blocks = this.storage.blocks.filter(blk => blk.isFileSystem && blk.isMounted && !blk.isVolumeDevice)
    let volumes = this.storage.volumes.filter(vol => vol.isMounted && !vol.isMissing)
    return [ ...blocks, ...volumes ]
  }

  // all blocks
  //  isFileSystem
  //  !isVolumeDevice
  //  isMounted
  // all volumes
  //  isMounted
  //  !
  getFileSystems (user, callback) {
    
  }

}
