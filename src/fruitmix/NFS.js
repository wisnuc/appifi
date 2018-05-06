const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const rimraf = require('rimraf')

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

  resolvePath (user, props, callback) {
    let drive = this.drives.find(drv => drv.isVolume ? drv.uuid === props.id : drv.name === props.id)
    if (!drive) {
      let err = new Error('drive not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let mp = drive.mountpoint
    try {
      let rawpath = path.join(mp, decodeURIComponent(props.path))
      let abspath = path.resolve(path.normalize(rawpath))
      if (!abspath.startsWith(mp)) throw new Error('invalid path')
      process.nextTick(() => callback(null, abspath))
    } catch (e) {
      e.status = 400
      process.nextTick(() => callback(e))
    }
  }

  /**

  @param {object} user
  @param {object} props
  */
  LIST (user, props, callback) {
    let drives = this.drives.map(drv => drv.isVolume
      ? { id: drv.uuid, type: drv.fileSystemType }
      : { id: drv.name, type: drv.fileSystemType })
    process.nextTick(() => callback(null, drives))
  }

  /**
  read a dir or download a file, path must be URI encoded string
  @param {object} props
  @param {string} props.id - volume uuid or block name
  @param {string} props.path - relative path
  */
  GET (user, props, callback) {
    this.resolvePath(user, props, (err, target) => {
      if (err) return callback(err)

      fs.lstat(target, (err, stat) => {
        if (err) {
          if (err.code === 'ENOENT' || err.code === 'ENOTDIR') err.status = 404
          callback(err)
        } else if (stat.isDirectory()) {
          fs.readdir(target, (err, entries) => {
            if (err) return callback(err)
            if (entries.length === 0) return callback(null, [])
            let count = entries.length
            let arr = []
            entries.forEach(entry => {
              fs.lstat(path.join(target, entry), (err, stat) => {
                if (!err) {
                  arr.push({
                    name: entry,
                    type: stat.isFile() ? 'file'
                      : stat.isDirectory() ? 'directory'
                        : stat.isSymbolicLink() ? 'link'
                          : stat.isSocket() ? 'socket'
                            : stat.isFIFO() ? 'fifo'
                              : stat.isCharacterDevice() ? 'char'
                                : stat.isBlockDevice() ? 'block' : 'unknown',
                    size: stat.size,
                    ctime: stat.ctime.getTime()
                  })
                }
                if (!--count) callback(null, arr) // TODO sort
              })
            })
          })
        } else if (stat.isFile()) {
          callback(null, target)
        } else {
          let err = new Error('target is neither a regular file nor a directory')
          err.status = 403
          callback(err)
        }
      })
    })
  }

  POSTFORM (user, props, callback) {
    let err = new Error('not implemented yet')
    err.status = 403
    process.nextTick(() => callback(err))
  }

  PATCH (user, props, callback) {
    let err = new Error('not implemented yet')
    err.status = 403
    process.nextTick(() => callback(err))
  }

  PUT (user, props, callback) {
    let err = new Error('not implemented yet')
    err.status = 403
    process.nextTick(() => callback(err))
  }

  DELETE (user, props, callback) {
    if (props.path === '') {
      let err = new Error('root cannot be deleted')
      err.status = 400
      return process.nextTick(() => callback(err))
    }

    this.resolvePath(user, props, (err, target) =>
      err ? callback(err) : rimraf(target, callback))
  }
}

module.exports = NFS
