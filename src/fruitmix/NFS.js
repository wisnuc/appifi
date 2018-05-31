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
Generate an unsupported file type error from fs.Stats

@param {fs.Stats} stat
*/
const EUnsupported = stat => {
  let err = new Error('target is not a regular file or directory')

  /** from nodejs 8.x LTS doc
  stats.isFile()
  stats.isDirectory()
  stats.isBlockDevice()
  stats.isCharacterDevice()
  stats.isSymbolicLink() (only valid with fs.lstat())
  stats.isFIFO()
  stats.isSocket()
  */
  if (stat.isBlockDevice()) {
    err.code = 'EISBLOCKDEV'
  } else if (stat.isCharacterDevice()) {
    err.code = 'EISCHARDEV'
  } else if (stat.isSymbolicLink()) {
    err.code = 'EISSYMLINK'
  } else if (stat.isFIFO()) {
    err.code = 'EISFIFO'
  } else if (stat.isSocket()) {
    err.code = 'EISSOCKET'
  } else {
    err.code = 'EISUNKNOWN'
  }

  err.xcode = 'EUNSUPPORTED'
  return err
}


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

  resolveId (user, props, callback) {
    let drive = this.drives.find(drv => drv.isVolume ? drv.uuid === props.id : drv.name === props.id)
    if (!drive) {
      let err = new Error('drive not found')
      err.status = 404
      process.nextTick(() => callback(err))
    } else {
      process.nextTick(() => callback(null, drive.mountpoint))
    }
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
          let err = EUnsupported(stat)
          err.status = 403
          callback(err)
        }
      })
    })
  }

  READDIR (user, props, callback) {
    this.GET(user, props, callback)
  }

  /**
  Clients have two different ways to provide path arguments to this API.
  1. provide path in query string.
  2. or, provide path in prelude part.


  This is detected by props.hasOwnProperty('path'). If the property exists, it is considered as
  case 1. Otherwise, it is case 2.

  Noting that if path is not provided, the client must provide prelude.

  @param {object} user
  @param {object} props
  */
  POSTFORM (user, props, callback) {

    let parts, dicer, index 
    let formdata = props.formdata

    const lstat = (target, callback) => 
      fs.lstat(target, (err, stats) => {
        if (err) {
          err.status = 403
          callback(err)
        } else if (!stats.isDirectory()) {
          let err = new Error('target is not a directory')
          err.code = 'ENOTDIR'
          err.status = 403
          callback(err)
        } else {
          callback(null)
        }
      })

    const handlePrelude = (prelude, callback) => {
      if (typeof prelude !== 'object' || prelude === null) {
        let err = new Error('invalid prelude')
        err.status = 400
        process.nextTick(() => callback(err))
      } else {
        this.resolvePath(user, Object.assign({}, prelude, { id: props.id  }), (err, target) => err
          ? callback(err)
          : lstat(target, err => err ? callback(err) : callback(null, target))) 
      }
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

    const createPipes = dirPath => {
      // index starts from -1 if prelude
      index = dirPath ? 0 : -1

      if (dirPath) {
        parts = new PartStream({ dirPath })
      } else {
        parts = new PartStream({ handlePrelude })
      }
      parts.on('error', handleError)
      parts.on('finish', () => callback())

      dicer = new Dicer({ boundary: props.boundary })
      dicer.on('part', part => {
        part.index = index++

        part.once('header', header => {
          debug('part early on header', part.index)
          part.header = header
        })

        part.on('error', err => {
          debug('part early on error', part.index)
          part.error = err
          part.removeAllListeners('error')
          part.on('error', () => {})
        })

        parts.write(part)
      })
      dicer.on('error', handleError)
      dicer.on('finish', () => {
        debug('dicer finish')
        parts.end()
      })

      formdata = props.formdata
      formdata.on('error', handleError)
      formdata.pipe(dicer)
    }

    if (props.hasOwnProperty('path')) {
      debug('props has path')
      this.resolvePath(user, props, (err, target) => 
        err ? callback(err) : lstat(target, err => 
          err ? callback(err) : createPipes(target)))
    } else {
      debug('props has no path')
      this.resolveId(user, props, (err, mp) => {
        if (err) return callback(err)
        createPipes()
      })
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


  /**
  This function is intended to support Policy.
  
  @param {object} user
  @param {object} props
  @param {string} props.id
  @param {string} props.path
  @param {string} props.name
  @param {string} props.data
  @param {Policy} props.policy
  */
  NEWFILE (user, props, callback) {
    this.resolvePath(user, props, (err, target) => {
      if (err) return callback(err)

      let dstFilePath = path.join(target, props.name) 
      openwx(dstFilePath, policy, (err, fd, resolved) => {
        if (err) {
          callback(err)
        } else {
          let rs = fs.createReadStream(props.data)
          let ws = fs.createWriteStream(null, { fd })

          ws.on('finish', () => {
            // callback(
          })

          rs.pipe(ws)

        }
      })    
    }) 
  }
}

module.exports = NFS
