const path = require('path')
const fs = require('fs')
const child = require('child_process')
const EventEmitter = require('events')

const rimraf = require('rimraf')
const sanitize = require('sanitize-filename')
const Dicer = require('dicer')
const debug = require('debug')('nfs')

const { isUUID, isNonNullObject } = require('../lib/assertion')
const autoname = require('../lib/autoname')
const PartStream = require('./nfs/PartStream')
const find = require('./nfs/find')

const xcode = stat => {
  if (stat.isFile()) {
    return 'EISFILE'
  } else if (stat.isDirectory()) {
    return 'EISDIRECTORY'
  } else if (stat.isBlockDevice()) {
    return 'EISBLOCKDEV'
  } else if (stat.isCharacterDevice()) {
    return 'EISCHARDEV'
  } else if (stat.isSymbolicLink()) {
    return 'EISSYMLINK'
  } else if (stat.isFIFO()) {
    return 'EISFIFO'
  } else if (stat.isSocket()) {
    return 'EISSOCKET'
  } else {
    return 'EISUNKNOWN'
  }
}

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
TODO the callback signature is changed, it should return { type, name } from fs.Stats
*/
const mkdir = (target, policy, callback) => {
  fs.mkdir(target, err => {
    if (err && err.code === 'EEXIST') {
      fs.lstat(target, (error, stat) => {
        if (error) return callback(error)

        const same = stat.isDirectory()
        const diff = !same

        if ((same && policy[0] === 'skip') || (diff && policy[1] === 'skip')) {
          callback(null, {
            type: 'directory',
            name: target.split('/').pop()
          }, [same, diff])
        } else if (same && policy[0] === 'replace' 
          || diff && policy[1] === 'replace') {
          rimraf(target, err => {
            if (err) return callback(err)
            mkdir(target, policy, err => {
              if (err) return callback(err)
              callback(null, { 
                type: 'directory', 
                name: target.split('/').pop()
              }, [same, diff])
            })
          }) 
        } else if (same && policy[0] === 'rename' 
          || diff && policy[1] === 'rename') {
          let dirname = path.dirname(target)
          let basename = path.basename(target)
          fs.readdir(dirname, (error, files) => {
            if (error) return callback(error)
            let target2 = path.join(dirname, autoname(basename, files))
            mkdir(target2, policy, (err, stat, resolved) => {
              if (err) return callback(err)
              callback(null, stat, [same, diff])
            })
          })
        } else {
          err.xcode = xcode(stat)
          callback(err)
        }
      })
    } else if (err) {
      callback(err)
    } else {
      // callback(null, null, [false, false])
      fs.lstat(target, (err, stat) => err
        ? callback(err) 
        : callback(null, {
            type: 'directory',
            name: target.split('/').pop()
          }, [false, false]))
    }
  }) 
}

// this function mimic policy-based file operation in vfs.
// TODO should be implemented in nfs
const openwx = (target, policy, callback) => {
  fs.open(target, 'wx', (err, fd) => {
    if (err && err.code === 'EEXIST') {
      fs.lstat(target, (error, stat) => {
        if (error) return callback(error)

        const same = stat.isFile()  
        const diff = !same

        if ((same && policy[0] === 'skip') || (diff && policy[1] === 'skip')) {
          callback(null, null, [same, diff])
        } else if (same && policy[0] === 'replace' || diff && policy[1] === 'replace') {
          rimraf(target, err => {
            if (err) return callback(err)
            openwx(target, policy, (err, fd) => {
              if (err) return callback(err)
              callback(null, fd, [same, diff])
            })
          })
        } else if (same && policy[0] === 'rename' || diff && policy[1] === 'rename') {
          let dirname = path.dirname(target)
          let basename = path.basename(target)
          fs.readdir(dirname, (error, files) => {
            if (error) return callback(error)
            let target2 = path.join(dirname, autoname(basename, files))
            openwx(target2, policy, (err, fd) => {
              if (err) return callback(err)
              callback(null, fd, [same, diff])
            })
          })
        } else {
          err.xcode = xcode(stat) 
          callback(err)
        }
      })
    } else if (err) {
      callback(err)
    } else {
      callback(null, fd, [false, false])
    }
  })
}

// no recursive
const mvfile = (oldPath, newPath, policy, callback) => 
  // stat target parent
  fs.lstat(path.dirname(newPath), (err, stat) => {
    if (err) {
      callback(err)
    } else if (!stat.isDirectory()) {
      let err = new Error('target parent is not a directory')
      err.code = 'ENOTDIR'
      callback(err)
    } else {
      // stat target
      fs.lstat(newPath, (err, stat) => {
        if (err && err.code === 'ENOENT') {
          fs.rename(oldPath, newPath, err => {
            if (err) {
              callback(err)
            } else {
              callback(null, null, [false, false])
            }
          })
        } else if (err) {
          callback(err) 
        } else {
          // resolve conflict
          let same = stat.isFile()
          let diff = !same

          if (same && policy[0] === 'skip') {
            callback(null, null, [true, false])
          } else if (diff && policy[1] === 'skip') {
            callback(null, null, [false, true])
          } else if (same && policy[0] === 'rename' || diff && policy[1] === 'rename') {
            let dirname = path.dirname(newPath)
            let basename = path.basename(newPath)
            fs.readdir(dirname, (err, names) => {
              if (err) return callback(err)
              let newPath2 = path.join(dirname, autoname(basename, names))
              fs.rename(oldPath, newPath2, err => {
                if (err) {
                  callback(err)
                } else {
                  callback(null, null, [same, diff])
                }
              })
            })
          } else if (same && policy[0] === 'replace' || diff && policy[1] === 'replace') {
            rimraf(newPath, err => {
              if (err) return callback(err)
              fs.rename(oldPath, newPath, err => {
                if (err) {
                  calblack(err)
                } else {
                  callback(null, null, [same, diff])
                }
              })
            })
          } else {
            // code is EEXIST
            // xcode is EISDIR, EISFILE etc
            let err = new Error('target exists')
            err.code = 'EEXIST'
            if (stat.isFile()) {
              err.xcode = 'EISFILE'
            } else if (stat.isDirectory()) {
              err.xcode = 'EISDIR'
            } else if (stat.isBlockDevice()) {
              err.xcode = 'EISBLOCKDEV'
            } else if (stat.isCharacterDevice()) {
              err.xcode = 'EISCHARDEV'
            } else if (stat.isSymbolicLink()) {
              err.xcode = 'EISSYMLINK'
            } else if (stat.isFIFO()) {
              err.xcode = 'EISFIFO'
            } else if (stat.isSocket()) {
              err.xcode = 'EISSOCKET'
            } else {
              err.xcode = 'EISUNKNOWN'
            }
            callback(err)
          }
        }
      })
    }
  })

const mvdir = (oldPath, newPath, policy, callback) => 
  // stat target parent
  fs.lstat(path.dirname(newPath), (err, stat) => {
    if (err) {
      callback(err)
    } else if (!stat.isDirectory()) {
      let err = new Error('target parent is not a directory')
      err.code = 'ENOTDIR'
      callback(err)
    } else {
      // stat target 

      let type = 'directory'
      let name = path.basename(newPath)

      fs.lstat(newPath, (err, stat) => {
        if (err && err.code === 'ENOENT') {
          fs.rename(oldPath, newPath, err => {
            if (err) {
              callback(err)
            } else {
              callback(null, { type, name }, [false, false])
            }
          })
        } else if (err) {
          callback(err)
        } else {
          // resolve conflict
          let same = stat.isDirectory()
          let diff = !same
         
          if (same && policy[0] === 'skip') {
            callback(null, { type, name }, [true, false])
          } else if (diff && policy[1] === 'skip') {
            callback(null, { type, name }, [false, true])
          } else if (same && policy[0] === 'rename' || diff && policy[1] === 'rename') {
            let dirname = path.dirname(newPath)
            fs.readdir(dirname, (err, names) => {
              if (err) return callback(err)
              let newName = autoname(name, names)
              fs.rename(oldPath, path.join(dirname, newName), err => {
                if (err) {
                  callback(err)
                } else {
                  callback(null, { type, name: newName }, [same, diff])
                }
              })
            })
          } else if (same && policy[0] === 'replace' || diff && policy[1] === 'replace') {
            rimraf(newPath, err => {
              if (err) return callback(err)
              fs.rename(oldPath, newPath, err => {
                if (err) {
                  callback(err)
                } else {
                  callback(null, { type, name }, [same, diff])
                }
              })
            })
          } else {
            // code is EEXIST
            // xcode is EISDIR, EISFILE etc
            let err = new Error('target exists')
            err.code = 'EEXIST'
            if (stat.isFile()) {
              err.xcode = 'EISFILE'
            } else if (stat.isDirectory()) {
              err.xcode = 'EISDIR'
            } else if (stat.isBlockDevice()) {
              err.xcode = 'EISBLOCKDEV'
            } else if (stat.isCharacterDevice()) {
              err.xcode = 'EISCHARDEV'
            } else if (stat.isSymbolicLink()) {
              err.xcode = 'EISSYMLINK'
            } else if (stat.isFIFO()) {
              err.xcode = 'EISFIFO'
            } else if (stat.isSocket()) {
              err.xcode = 'EISSOCKET'
            } else {
              err.xcode = 'EISUNKNOWN'
            }
            callback(err)
          }
        }
      })
    }
  })

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

    if (opts.volumeUUID) this.volumeUUID = opts.volumeUUID
    if (opts.ejectHandler) this.ejectHandler = opts.ejectHandler
    
    this.allowATA = false
    this.allowUSB = true

    /**
    a drive is acturally a file system that:
    1. can be a volume, a standalone disk, or a partition
    */
    this.drives = []

    this.fruitfs = null
  }

  update (storage) {
    let { blocks, volumes } = storage

    let vols = volumes.filter(vol => {
      if (vol.isMissing) return false
      if (!vol.isMounted) return false
      if (vol.isRootFS) return false
      if (this.volumeUUID && vol.uuid === this.volumeUUID) {
        this.fruitfs = vol
        return false
      }
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
    this.emit('usb', blks.filter(x => x.isUSB).map(x => ({
      name: x.name.slice(2),
      mountpoint: x.mountpoint,
      readOnly: !!x.isMountedRO
    })))
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
    const drvToPhy = drv => {
      let phy = {
        id: drv.isVolume ? drv.uuid : drv.name,
        type: drv.fileSystemType,
        readOnly: drv.isMountedRO
      }

      if (drv.isVolume && drv.uuid === this.volumeUUID) phy.isFruitFS = true
      if (drv.isUSB) phy.isUSB = true
      if (drv.mountpoint) phy.mountpoint = drv.mountpoint
      return phy
    }

    if (props.usage === 'true') {
      let drives = [this.fruitfs, ...this.drives]
      let count = drives.length
      let arr = []

      drives.forEach(drv => {
        let phy = drvToPhy(drv) 
        arr.push(phy)

        child.exec(`df -P "${drv.mountpoint}"`, (err, stdout) => {
          if (!err) {
            let lines = stdout.toString().trim().split('\n')
            if (lines.length === 2) {
              let xs = lines[1].split(' ').filter(x => !!x)
              if (xs.length === 6) {
                phy.usage = {
                  total: parseInt(xs[1]),
                  used: parseInt(xs[2]),
                  available: parseInt(xs[3])
                }
              }
              if (drv.isVolume && drv.isBtrfs) {
                let total
                let sizeArr = drv.devices.map(d => d.size).sort((a, b) => a > b ? 1 : a < b ? -1 : 0)
                if (drv.usage && drv.usage.data && drv.usage.data.mode.toLowerCase() === 'raid1') {
                  let max = sizeArr.pop()
                  let offmax = sizeArr.reduce((acc, a) => a + acc, 0)
                  total = max > offmax ? offmax : (offmax + max)/2
                } else {
                  total = sizeArr.reduce((acc, a) => a + acc, 0)
                }
                phy.usage.total = total / 1024
              }
            }
          } else {
            if (!process.env.NODE_PATH) console.log(err)
          }
          if (!--count) callback(null, arr)
        })
      })
    } else {
      process.nextTick(() => callback(null, this.drives.map(drvToPhy)))
    }
  }


  /**
  read a dir or download a file

  @param {object} props
  @param {string} props.id - volume uuid or block name
  @param {string} props.path - relative path

  @param {string} props.token - if provided, considered to be a find
  @param {string} props.lastPath - path string relative to path
  @param {string} props.lastType - directory or file

  */
  GET (user, props, callback) {
    const fileType = stat => {
      if (stat.isFile()) {
        return 'file'
      } else if (stat.isDirectory()) {
        return 'directory'
      } else if (stat.isSymbolicLink()) {
        return 'symlink'
      } else if (stat.isSocket()) {
        return 'socket'
      } else if (stat.isFIFO()) {
        return 'fifo'
      } else if (stat.isCharacterDevice()) {
        return 'char'
      } else if (stat.isBlockDevice()) {
        return 'block'
      } else {
        return 'unknown'
      }
    } 

    debug('GET', user, props)
    this.resolvePath(user, props, (err, target) => {
      if (err) return callback(err)

      fs.lstat(target, (err, stat) => {
        if (err) {
          if (err.code === 'ENOENT' || err.code === 'ENOTDIR') err.status = 403
          callback(err)
        } else if (stat.isDirectory()) {
          if (props.name) {
            let root = target
            let token = props.name
            let count = parseInt(props.count)
            if (!Number.isInteger(count) || count === 0 || count > 5000) count = 5000

            let last
            if (props.last) {
              let lastType, lastPath
              if (props.last.startsWith('directory.')) {
                lastType = 'directory'
                lastPath = props.last.slice('directory.'.length).split('/').filter(x => !!x) 
              } else if (props.last.startsWith('file.')) {
                lastType = 'file'
                lastPath = props.last.slice('file.'.length).split('/').filtr(x => !!x)
              } else {
                let err = new Error('invalid last')
                err.status = 400
                return callback(err)
              }

              last = { type: lastType, namepath: lastPath }
            } 

            find(root, token, count, last, callback)  
          } else {
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
                      type: fileType(stat),
                      size: stat.isFile() ? stat.size : undefined,
                      mtime: stat.mtime.getTime()
                    })
                  }
                  if (!--count) callback(null, arr) // TODO sort
                })
              })
            })
          }
        } else if (stat.isFile()) {
          if (props.token) {
            let err = new Error('target is not a dir')
            err.status = 403
            callback(err)
          } else {
            callback(null, target)
          }
        } else {
          if (props.token) {
            let err = new Error('target is not a dir')
            err.status = 403
            callback(err)
          } else {
            let err = EUnsupported(stat)
            err.status = 403
            callback(err)
          }
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
  @param {object} props.policies
  @param {object} props.policies.dir
  @param {object} props.policies.file
  */
  PATCH (user, props, callback) {
    if (props.op) { // TODO TO BE REMOVED
      if (props.op === 'eject' && this.ejectHandler) {
        return this.ejectHandler(props.id, callback)
      }
      return callback(new Error('invalid op'))
    } else { 
      let policy = props.policy
      if (policy) {
        let valids = [undefined, null, 'skip', 'replace', 'rename']
        if (Array.isArray(policy) && valids.includes(policy[0]) && valids.includes(policy[1])) {
          // bypass
        } else {
          let err = new Error('invalid policy')
          err.status = 400
          return process.nextTick(() => callback(err))
        }
      } else {
        policy = [null, null]
      }

      this.resolvePaths(user, props, (err, paths) => {
        if (err) return callback(err)
        let { oldPath, newPath } = paths
        let policy = props.policy || [null, null]
  
        fs.lstat(oldPath, (err, stat) => {
          if (err) {
            if (err.code === 'ENOENT') {
              let err = new Error('old path not found')
              err.code = 'ENOENT'
              err.status = 404
              callback(err)
            } else if (err.code === 'ENOTDIR') {
              let err = new Error('old path invalid')
              err.code = 'ENOTDIR'
              err.status = 400
              callback(err)
            } else {
              callback(err)
            }
          } else {
            if (stat.isDirectory()) {
              mvdir(oldPath, newPath, policy, (err, _, resolved) => {
                if (err) {
                  if (err.code === 'EEXIST') err.status = 403
                  callback(err) 
                } else {
                  callback(null, { policy, resolved })
                }
              })
            } else if (stat.isFile()) {
              mvfile(oldPath, newPath, policy, (err, _, resolved) => {
                if (err) {
                  if (err.code === 'EEXIST') err.status = 403
                  callback(err) 
                } else {
                  callback(null, { policy, resolved })
                }
              })
            } else {
              let err = EUnsupported(stat)   
              err.status = 403
              callback(err)
            }
          }
        })
      })
    }
  }

  /**
  @param {object} user
  @param {object} props
  @param {string} props.id
  @param {string} props.path
  */
  DELETE (user, props, callback) {
    this.resolvePath(user, props, (err, target) => {
      if (err) return callback(err)
      if (props.path === undefined || props.path === '') {
        if (this.ejectHandler) {
          this.ejectHandler(props.id, callback)
        } else {
          let err = new Error('operation is not supported')
          err.status = 403
          process.nextTick(() => callback(err))
        }
      } else if (props.path === '') {
        let err = new Error('root cannot be deleted')
        err.status = 400
        process.nextTick(() => callback(err))
      } else {
        rimraf(target, err => {
          if (err) err.status = 403
          callback(err)
        })
      }
    })
  }

  REMOVE (user, props, callback) {
    let id = props.drive
    let p = path.join(props.dir, props.name)
    this.DELETE(user, { id, path: p }, callback)
  }


  /**
  This function is intended to support Policy.

  TODO
  This function is different from that of nfs, which is an atomic operation.
  Instead, a file descriptor is return via callback for user to stream data.
  
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
      openwx(dstFilePath, props.policy, (err, fd, resolved) => {
        if (err) {
          callback(err)
        } else if (fd === null) { // in case resolved to skip
          callback(null, null, resolved)
        } else {
          let rs = fs.createReadStream(props.data)
          let ws = fs.createWriteStream(null, { fd })
          ws.on('finish', () => callback(null, null, resolved)) 
          rs.pipe(ws)
        }
      })    
    }) 
  }

  /**
  this function returns { rs, ws }, resolved

  @param {object} user
  @param {object} props
  @param {object} props.src
  @param {string} props.src.drive
  @param {string} props.src.dir
  @param {string} props.src.name
  @param {object} props.dst
  @param {string} props.dst.drive
  @param {string} props.dst.dir
  @param {Policy} props.policy
  */
  CPFILE (user, props, callback) {
    let { src, dst, policy } = props
    this.resolvePath(user, { id: src.drive, path: src.dir } , (err, srcDirPath) => {
      if (err) return callback(err)
      this.resolvePath(user, { id: dst.drive, path: dst.dir }, (err, dstDirPath) => {
        if (err) return callback(err)
        let srcFilePath = path.join(srcDirPath, props.src.name)
        let dstFilePath = path.join(dstDirPath, props.src.name)
        openwx(dstFilePath, props.policy, (err, fd, resolved) => {
          if (err) {
            callback(err)
          } else if (fd === null) {
            callback(null, null, resolved)
          } else {
            let rs = fs.createReadStream(srcFilePath)
            let ws = fs.createWriteStream(null, { fd })
            callback(null, { rs, ws }, resolved)
          }
        })
      })
    })
  }

  /**
  @param {object} user
  @param {object} props
  @param {string} props.id
  @param {string} props.path
  @param {string} props.name
  @param {Policy} props.policy
  */
  MKDIR (user, props, callback) {
    this.resolvePath(user, props, (err, dirPath) => {
      if (err) return callback(err)
      
      let target = path.join(dirPath, props.name)
      let policy = props.policy || [null, null]
      mkdir(target, policy, (err, stat, resolved) => {
        if (err) return callback(err)
        callback(null, stat, resolved) 
      })
    }) 
  }

  /**
  @param {object} user
  @param {object} props
  @param {string} props.id
  @param {string} props.path
  @param {string} props.names
  @param {string} props.policy 
  */
  MKDIRS (user, props, callback) {
    this.resolvePath(user, props, (err, dirPath) => {
      if (err) return callback(err)
      let names = props.names
      let policy = props.policy || [null, null]
      let count = names.length
      let map = new Map()

      names.forEach(name => {
        let target = path.join(dirPath, name)
        mkdir(target, policy, (err, stat, resolved) => {
          map.set(name, { err, stat, resolved })
          if (!--count) callback(null, map)
        })
      })
    })
  }

  /**
  @param {object} user
  @param {object} props
  @param {string} props.id
  @param {string} props.srcPath
  @param {string} props.dstPath 
  @param {string[]} props.names
  @param {Policy} props.policy
  */
  MVDIRS (user, props, callback) {
    let { names, policy } = props
    this.resolvePath(user, { id: props.id, path: props.srcPath }, (err, srcDirPath) => {
      if (err) return callback(err)
      this.resolvePath(user, { id: props.id, path: props.dstPath }, (err, dstDirPath) => {
        if (err) return callback(err) 
        let count = names.length
        let map = new Map()
        names.forEach(name => {
          let oldPath = path.join(srcDirPath, name)
          let newPath = path.join(dstDirPath, name)
          mvdir(oldPath, newPath, policy, (err, stat, resolved) => {
            map.set(name, { err, stat, resolved })
            if (!--count) callback(null, map)
          })
        })
      }) 
    }) 
  }

  /**
  move a single file from srcPath (dir) to dstPath (dir)  

  @param {object} user
  @param {object} props
  @param {string} props.id
  @param {string} props.srcPath
  @parma {string} props.dstPath
  @param {string} props.name
  @param {Policy} props.policy
  */
  MVFILE (user, props, callback) {
    let { name, policy } = props
    this.resolvePath(user, { id: props.id, path: props.srcPath }, (err, srcDirPath) => {
      if (err) return callback(err)
      this.resolvePath(user, { id: props.id, path: props.dstPath }, (err, dstDirPath) => {
        if (err) return callback(err)
        let oldPath = path.join(srcDirPath, name) 
        let newPath = path.join(dstDirPath, name)
        mvfile(oldPath, newPath, policy, callback)
      })
    })
  }

  /**
  This function calls rmdir to remove an directory, the directory won't be removed if non-empty

  @param {object} user
  @param {object} props
  @param {object} props.drive
  @param {object} props.dir
  */
  RMDIR (user, props, callback) {
    this.resolvePath(user, { id: props.drive, path: props.dir }, (err, dirPath) => {
      if (err) return callback(err)
      fs.rmdir(dirPath, () => callback(null))
    }) 
  }


  /**
  @param {string} root - root dir
  @param {string} [last - a relative path
  @param {number} count 
  @param {string} name - containing string
  */
  find (root, last, count, name) {

  }
}

module.exports = NFS
