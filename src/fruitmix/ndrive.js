const path = require('path')
const fs = require('fs')

const { isUUID } = require('../lib/assertion')

const ndriveapi = {

  ndrives: [],

  setStorage (storage) {
    let blocks = storage.blocks
      .filter(blk => blk.isFileSystem && blk.isMounted && !blk.isVolumeDevice)  
      .map(blk => ({
        id: blk.name,
        fileSystemType: blk.fileSystemType,
        fileSystemUUID: blk.fileSystemUUID,
        mountpoint: blk.mountpoint
      }))

    let volumes = storage.volumes
      .filter(vol => vol.isMounted && !vol.isMissing)
      .map(vol => ({
        id: vol.uuid,
        fileSystemType: vol.fileSystemType,
        fileSystemUUID: vol.fileSystemUUID,
        mountpoint: vol.mountpoint
      }))

    this.ndrives = [...blocks, ...volumes].filter(ndrv => {
      // remove rootfs
      if (ndrv.mountpoint === '/') return false   
      // remove fs that hosting current fruitmix instance
      if (path.join(ndrv.mountpoint, 'wisnuc', 'fruitmix') === this.fruitmixPath) return false

      return true
    })
  },

  /**
  Returns native drive list

  */
  getNativeDrives (user, callback) {
    process.nextTick(() => callback(null, this.ndrives))
  },

  getNativeDriveEntry (user, id, relpath, callback) {
    let ndrv = this.ndrives.find(nd => nd.id === id)
    if (!ndrv) {
      let err = new Error(`native drive ${id} not found`)
      err.code = 'ENOTFOUND'
      err.status = 404
      process.nextTick(() => callback(err))
    } else {
      let abspath = path.join(ndrv.mountpoint, relpath)

      console.log(abspath)

      fs.lstat(abspath, (err, stat) => {
        if (err) return callback(err)
        if (stat.isFile()) {
          callback(null, abspath)
        } else if (stat.isDirectory()) {
          fs.readdir(abspath, (err, entries) => {

            console.log(entries)

            if (err) return callback(err)
            if (entries.length === 0) return callback(null, [])

            let count = entries.length
            let arr = []
            entries.forEach(entry => {
              fs.lstat(path.join(abspath, entry), (err, stat) => {
                if (!err && ( stat.isFile() || stat.isDirectory())) {
                  let obj
                  if (stat.isFile()) {
                    obj = {
                      type: 'file',
                      name: entry,
                      size: stat.size,
                      mtime: stat.mtime.getTime()
                    }
                  } else {
                    obj = {
                      type: 'directory',
                      name: entry,
                    }
                  }

                  arr.push(obj)
                }
                if (!--count) return callback(null, arr)
              })
            })
          })
        } else {
          let err = new Error(`not supported file type`) 
          err.code = 'EUNSUPPORTED'
          err.status = 403
          callback(err)
        }
      })
    }
  }

}

module.exports = ndriveapi
