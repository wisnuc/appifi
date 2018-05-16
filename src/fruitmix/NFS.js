const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const rimraf = require('rimraf')
const sanitize = require('sanitize-filename')
const Dicer = require('dicer')
const debug = require('debug')('nfs')

const { isUUID, isNonNullObject } = require('../lib/assertion')
const PartStream = require('./nfs/PartStream')

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

  checkPath (path) {
    if (typeof path !== 'string') throw new Error('invalid path')
    let names = path.split('/')
    if (names.includes('')) 
      throw new Error('invalid path, leading, trailing, or successive slash not allowed')
    if (!names.every(name => name === sanitize(name)))
      throw new Error('invalid path, containing invalid name')
  }

  resolvePath (user, props, callback) {
    let drive = this.drives.find(drv => drv.isVolume ? drv.uuid === props.id : drv.name === props.id)
    if (!drive) {
      let err = new Error('drive not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let mp = drive.mountpoint
    if (props.path === undefined || props.path === '')  
      return process.nextTick(() => callback(null, mp))

    try {
      this.checkPath(props.path)
      process.nextTick(() => callback(null, path.join(mp, props.path)))    
    } catch (err) {
      err.status = 400
      process.nextTick(() => callback(err))
    }
  }

  // resolve oldPath and newPath
  resolvePaths (user, props, callback) {
    let drive = this.drives.find(drv => drv.isVolume ? drv.uuid === props.id : drv.name === props.id)
    if (!drive) {
      let err = new Error('drive not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    try {
      this.checkPath(props.oldPath)
      this.checkPath(props.newPath)
      process.nextTick(() => callback(null, {
        oldPath: path.join(drive.mountpoint, props.oldPath),
        newPath: path.join(drive.mountpoint, props.newPath)
      }))
    } catch (err) {
      err.status = 400
      process.nextTick(() => callback(err))
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
  read a dir or download a file



  @param {object} props
  @param {string} props.id - volume uuid or block name
  @param {string} props.path - relative path
  */
  GET (user, props, callback) {
    debug('GET', user, props)
    this.resolvePath(user, props, (err, target) => {
      if (err) return callback(err)

      fs.lstat(target, (err, stat) => {
        if (err) {
          if (err.code === 'ENOENT' || err.code === 'ENOTDIR') err.status = 403
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
          err.code = 'EUNSUPPORTED'
          err.status = 403
          callback(err)
        }
      })
    })
  }

  


  /**
  @param {object} user
  @param {object} props
  */
  POSTFORM (user, props, callback) {
    if (props.hasOwnProperty('path')) {
      this.resolvePath(user, props, (err, target) => {
        if (err) return callback(err)
        fs.lstat(target, (err, stats) => {
          if (err) return callback(err)
          if (!stats.isDirectory()) {
            let err = new Error('target is not a directory')
            err.status = 403
            return callback(err)
          }

          const handleError = err => {
            formdata.unpipe()
            formdata.removeListener('error', handleError)
            formdata.on('error', () => {})
            dicer.removeAllListeners()
            dicer.on('error', () => {})
            parts.removeAllListeners()
            parts.on('error', () => {})
            parts.destroy()
            callback(err)
          }

          let parts = new PartStream({ dirPath: target })
          parts.on('error', handleError)
          parts.on('finish', () => callback())
          
          let dicer = new Dicer({ boundary: props.boundary })
          dicer.on('part', part => parts.write(part))
          dicer.on('error', handleError)
          dicer.on('finish', () => parts.end())

          let formdata = props.formdata
          formdata.on('error', handleError)
          formdata.pipe(dicer)
        })
      })
    } else {
      callback(new Error('not implemented'))
    }
  }

  /**
  @param {object} user
  @param {object} props
  */
  PATCH (user, props, callback) {
    this.resolvePaths(user, props, (err, paths) => {
      if (err) return callback(err)
      let { oldPath, newPath } = paths
      fs.rename(oldPath, newPath, err => {
        if (err) err.status = 403
        callback(err)
      })
    })
  }

  /**
  @param {object} user
  @param {object} props
  */
  DELETE (user, props, callback) {
    this.resolvePath(user, props, (err, target) => {
      if (err) return callback(err)
      if (props.path === undefined || props.path === '') {
        let err = new Error('root cannot be deleted')
        err.status = 400
        return process.nextTick(() => callback(err))
      }

      rimraf(target, err => {
        if (err) err.status = 403
        callback(err)
      })
    })
  }
}

module.exports = NFS
