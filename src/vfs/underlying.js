const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const { readXstat, forceXstat } = require('../lib/xstat')
const btrfs = require('../lib/btrfs')
const autoname = require('../lib/autoname') 

/**
This function create a new link for given tmp file (or directory)

a hash/fingerprint value can be provided if the tmp file is a regular file.

If there is name conflict, the function try to resolve the conflict according to 
policy.

for file
link(target, tmp, (uuid), (hash), opt, callback)

for directory
link(target, null, (uuid), null, opt, callback)

*/ 
const link = (target, tmp, uuid, hash, opt, callback) => {
  const type = tmp ? 'file' : 'directory'
  const f = tmp
    ? cb => forceXstat(tmp, { uuid, hash }, (err, xstat) => err ? cb(err) : fs.link(tmp, target, cb))
    : cb => fs.mkdir(target, cb)

  f(err => {
    if (err && err.code === 'EEXIST') {                   // conflict
      if (opt == 'rename') {
        let dirname = path.dirname(target)
        let basename = path.basename(target)
        fs.readdir(dirname, (error, files) => {
          if (error) return callback(error)
          let target2 = path.join(dirname, autoname(basename, files))
          link(target2, tmp, uuid, hash, opt, (err, xstat) => 
            err ? callback(err) : callback(null, xstat, true))
        })
      } else {  // keep, replace, or vanilla
        readXstat(target, (error, xstat) => {
          if (error && error.xcode === 'EUNSUPPORTED') {
            err.xcode = error.code
            callback(err)
          } else if (error) {
            callback(error)
          } else {
            if (opt === 'keep' && xstat.type === type) {
              callback(null, xstat, true)
            } else if (opt === 'replace' && xstat.type === type) {
              rimraf(target, error => {
                if (error) return callback(error)
                link(target, tmp, xstat.uuid, hash, opt, (err, xstat) => 
                  err ? callback(err) : callback(null, xstat, true))
              })
            } else {
              err.xcode = xstat.type === 'directory' ? 'EISDIR' : 'EISFILE'  
              callback(err)
            }
          }
        })
      } 
    } else if (err) {                                     // failed
      callback(err)
    } else {                                              // successful
      if (type === 'directory' && uuid) {
        forceXstat(target, { uuid }, (err, xstat) => 
          err ? callback(err) : callback(null, xstat, false))
      } else {
        readXstat(target, (err, xstat) => 
          err ? callback(err) : callback(null, xstat, false))
      }
    }
  })
}

const mkdirLink = (target, opt, callback) => link(target, null, null, null, opt, callback)
const mkfileLink = (target, tmp, hash, opt, callback) => link(target, tmp, null, hash, opt, callback) 

const mkfile2 = (filePath, tmpPath, hash, opt, callback) => {

  if (opt === 'replace') {
    fs.link(tmpPath, filePath, err => {
      if (err && err.code === 'EEXIST') {
        readXstat(filePath, (error, xstat) => {
          if (error && error.xcode !== 'EUNSUPPORTED') {
            callback(error)
          } else {
            if (error) {
              err.xcode = error.code // keep special file type
              callback(err)
            } else {
              if (xstat.type === 'directory') {
                err.xcode = 'EISDIR'
                callback(err)
              } else {
                let opt = { uuid: xstat.uuid }
                if (hash) opt.hash = hash
                forceXstat(tmpPath, opts, (err, xstat) => {
                  if (err) return callback(err)
                  fs.rename(tmpPath, filePath, err => {
                    if (err) return callback(err)
                    readXstat(filePath, (err, xstat) => {
                      if (err) return callback(err)
                      callback(null, xstat, true)
                    })
                  })
                })
              }
            }
          }
        })        
      } else if (err) {
        callback(err)
      } else {
        if (hash) {
          forceXstat(filePath, { hash }, (err, xstat) => err
            ? callback(err)
            : callback(null, xstat, false))
        } else {
          readXstat(filePath, (err, xstat) => err
            ? callback(err)
            : callback(null, xstat, false))
        }
      }
    })
  } else if (opt === 'rename') {
    fs.link(tmpPath, filePath, err => {
      if (err && err.code === 'EEXIST') {
        let dirname = path.dirname(filePath) 
        let basename = path.basename(filePath)
        fs.readdir(dirname, (error, names) => {
          if (error) {
            callback(error)
          } else {
            let filePath2 = path.join(dirname, autoname(basename, names))
            fs.link(tmpPath, filePath2, err => {
              if (err) return callback(err)
              
            })
          }
        })
      } else if (err) {
        callback(err)
      } else {
        if (hash) {
          forceXstat(filePath, { hash }, (err, xstat) => err
            ? callback(err)
            : callback(null, xstat, false))
        } else {
          readXstat(filePath, (err, xstat) => err
            ? callback(err)
            : callback(null, xstat, false))
        }
      }
    })
  } else {
    fs.link(tmpPath, filePath, err => {
      if (err && err.code === 'EEXIST') {
        readXstat(filePath, (error, xstat) => {
          if (error && error.xcode !== 'EUNSUPPORTED') {
            callback(error)
          } else {
            err.xcode = error
              ? error.code
              : xstat.type === 'directory' ? 'EISDIR' : 'EISFILE'  

            callback(err)
          }
        })
      } else if (err) {
        callback(err)
      } else {
        if (hash) {
          forceXstat(filePath, { hash }, callback) 
        } else {
          readXstat(filePath, callback)
        }
      }
    })

  } 
}


/**
mkdir

fs.mkdir returns EEXIST if name conflicts. But it does not tell if the existing file is a regular file,
directory, or other kind of special files. 

This may raise the problem for caller to decide next operation. 

There are two ways to define `conflict`. If the existing target is a regular file, 
it can be considered as `failure`, not `conflict`. Or, it is considered to be a `conflict`,
since user may remove the existing file anyway. 

`mkdir` should leave this problem to upper layer, without implementing the conflict as a mechanism.

 





problem 
1: fs.mkdir returns just EEXIST irrelevent to file type.
2: if parent ERROR, such as ENOTDIR or ENOENT, vfs is interested on such error. But unable to diff.

opt: null or undefined, 'keep', 'replace', 'rename'

@param {string} dirPath - directory path to make
@param {string} opt - `keep`, `rename`, or else. How to resolve a name conflict
@param {function} callback - `(err, xstat, resolved) => {}`
*/
const mkdir = (dirPath, opt, callback) => {
  // validate opt
  if ([undefined, null, 'keep', 'replace', 'rename'].includes(opt) === false) {
    let err = new Error(`invalid opt argument: ${opt}`)
    err.code = 'EINVAL'
    process.nextTick(() => callback(err))
    return
  }

  if (opt === 'keep') {
    // mkdirp cannot be used here
    // if parent dir does not exist, it succeeds.
    fs.mkdir(dirPath, err => {
      if (err && err.code === 'EEXIST') {
        readXstat(dirPath, (error, xstat) => {
          if (error && error.xcode !== 'EUNSUPPORTED') {
            callback(error)
          } else {
            if (error) {
              err.xcode = error.code // keep special file type
              callback(err)
            } else {
              if (xstat.type === 'directory') {
                callback(null, xstat, true)
              } else {
                err.xcode = 'EISFILE'
                callback(err)
              }
            }
          }
        })
      } else if (err) {
        callback(err)
      } else {
        readXstat(dirPath, callback)
      }
    })
  } else if (opt === 'replace') { // replace should keep uuid
    fs.mkdir(dirPath, err => {
      if (err && err.code === 'EEXIST') {
        readXstat(dirPath, (error, xstat) => {
          if (error && error.xcode !== 'EUNSUPPORTED') {
            callback(error) 
          } else {
            if (error) {
              err.xcode = error.code // keep special file type
              callback(err)
            } else {
              if (xstat.type === 'directory') {
                rimraf(dirPath, err => {
                  if (err) return callback(err)
                  fs.mkdir(dirPath, err => {
                    if (err) return callback(err)
                    let uuid = xstat.uuid
                    forceXstat(dirPath, { uuid }, (err, xstat2) => {
                      if (err) return callback(err)
                      callback(null, xstat2, true) 
                    })
                  })
                })
              } else {
                err.xcode = 'EISFILE'
                callback(err)
              }
            }
          } 
        })
      } else if (err) {
        callback(err)
      } else {
        readXstat(dirPath, (err, xstat) => err 
          ? callback(err) 
          : callback(null, xstat, false))
      }
    })
  } else if (opt === 'rename') { // auto rename
    fs.mkdir(dirPath, err => {
      if (err && err.code === 'EEXIST') {
        let dirname = path.dirname(dirPath)
        let basename = path.basename(dirPath)
        fs.readdir(dirname, (error, names) => {
          if (error) {
            callback(error)
          } else {
            let dirPath2 = path.join(dirname, autoname(basename, names))
            fs.mkdir(dirPath2, err => err
              ? callback(err)
              : readXstat(dirPath2, (err, xstat) => err 
                  ? callback(err) 
                  : callback(null, xstat, true))) 
          }
        })
      } else if (err) {
        callback(err)
      } else {
        readXstat(dirPath, (err, xstat) => err 
          ? callback(err) 
          : callback(null, xstat, false))
      }
    })
  } else { // undefined or null
    fs.mkdir(dirPath, err => {
      if (err && err.code === 'EEXIST') {
        readXstat(dirPath, (error, xstat) => {
          if (error && error.xcode !== 'EUNSUPPORTED') {
            callback(error)
          } else {
            if (error) {
              err.xcode = error.code // keep special file type
            } else {
              err.xcode = xstat.type === 'directory' ? 'EISDIR' : 'EISFILE'
            }
            callback(err)
          }
        })
      } else if (err) {
        callback(err)
      } else {
        readXstat(dirPath, callback)
      }
    })
  }

}


/**
Create a fruitmix file from a tmp file

@param {string} tmpPath - tmp file path
@param {string} filePath - target file path
@param {string} conflict - may be `overwrite`, `rename`, or others
@param {function} callback - `(err, xstat) => {}`
*/
const commitFile = (tmpPath, filePath, conflict, callback) => {
  if (conflict === 'overwrite') {
    fs.rename(tmpPath, filePath, err => {
      if (err) {
        callback(err)
      } else {
        readXstat(filePath, callback)
      }
    })
  } else {
    fs.link(tmpPath, filePath, err => {
      if (err) {
        if (err.code === 'EEXIST' && conflict === 'rename') {
          let dirname = path.dirname(filePath) 
          let basename = path.dirname(filePath)
          fs.readdir(dirname, (err, names) => {
            if (err) return callback(err)
            let filePath2 = path.join(dirname, autoname(basename, names))
            fs.link(tmpPath, filePath2, err => {
              if (err) return callback(err)
              rimraf(tmpPath, () => {})
              readXstat(filePath, callback)
            })
          })
        } else {
          callback(err) 
        }
      } else {
        rimraf(tmpPath, () => {}) 
        readXstat(filePath, callback)
      }
    })
  } 
}

/**
Clone a file from fruitmix into tmp dir
*/
const cloneFile = (filePath, fileUUID, tmpPath, preserve, callback) => {
  readXstat(filePath, (err, xstat) => {
    if (err) return callback(err)

    if (xstat.type !== 'file') {
      let err = new Error('not a file')
      err.code = 'ENOTFILE'
      return callback(err)
    }

    if (xstat.uuid !== fileUUID) {
      let err = new Error('uuid mismatch')
      err.code = 'EUUIDMISMATCH'
      return callback(err)
    }

    clone(filePath, tmpPath, err => {
      if (err) return callback(err)

      fs.lstat(filePath, (err, stat) => {
        if (err) {
          rimraf(tmpPath, () => {})
          return callback(err)
        } 

        if (stat.mtime.getTime() !== xstat.mtime) {
          rimraf(tmpPath, () => {})
          let err = new Error('timestamp mismatch before and after cloning file')
          err.code === 'ETIMESTAMPMISMATCH'
          return callback(err)
        }

        if (preserve) {
          let opt = {}
          if (preserve.uuid) opt.uuid = xstat.uuid
          if (preserve.hash && xstat.hash) opt.hash = xstat.hash
          forceXstat(tmpPath, opt, err => {
            if (err) {
              rimraf(tmpPath, () => {})
              callback(err)
            } else {
              callback(null)
            }
          })
        } else {
          callback(null) 
        }
      })
    })
  }) 
}

const clone = (filePath, fileUUID, tmp, callback) => 
  readXstat(filePath, (err, xstat) => {
    if (err) return callback(err)

    if (xstat.type !== 'file') {
      let err = new Error('not a file')
      err.code = 'ENOTFILE'
      return callback(err)
    }

    if (xstat.uuid !== fileUUID) {
      let err = new Error('uuid mismatch')
      err.code = 'EUUIDMISMATCH'
      return callback(err)
    }

    btrfs.clone(filePath, tmp, err => {
      if (err) return callback(err)

      // check timestamp
      fs.lstat(filePath, (err, stat) => {
        if (err || stat.mtime.getTime() !== xstat.mtime) {
          rimraf(tmp, () => {})
          if (err) return callback(err)
          let error = new Error('timestamp changed')
          error.code = 'ETIMESTAMP'
          return callback(error)
        } else {
          callback(null, xstat)
        }
      })
    })
  })

/**
*/
const stageExtFile = (extPath, tmpPath, callback) => {
//  fs.createReadStream(extPath, 'r
}

module.exports = {
  link,
  clone,
  mkdir: mkdirLink,
  mkfile: mkfileLink,
  cloneFile,
  commitFile,
}










