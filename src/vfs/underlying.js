const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const { readXstat, forceXstat } = require('../lib/xstat')
const { clone } = require('../lib/btrfs')
const autoname = require('../lib/autoname') 

/**
mkdir

vanilla: new (may be conflict)
parents: mkdirp (merge) - this is the same logic
rename: (keep both) - this is the diff logic

problem 1: fs.mkdir returns just EEXIST irrelevent to file type.
problem 2: if parent ERROR, such as ENOTDIR or ENOENT, vfs is interested on such error. But unable to diff.

no replace logic is provided, you cannot use an empty folder to replace a whole sub-tree.

@param {string} dirPath - directory path to make
@param {string} resolve - `parents`, `rename`, or else. How to resolve a name conflict
@param {function} callback - `(err, xstat, resolved) => {}`
*/
const mkdir = (dirPath, resolve, callback) => {
  if (resolve === 'parents') { // parents (keep if conflict)
    // 
    // mkdirp cannot be used here for if parent dir does not exist, it succeeds.
    //
    fs.mkdir(dirPath, err => {
      if (err && err.code === 'EEXIST') {
        fs.lstat(dirPath, (e, stat) => {
          if (e) {
            err.xcode = 'EAGAIN'
          } else if (stat.isDirectory()) {
            readXstat(dirPath, (err, xstat) => err
              ? callback(err)  
              : callback(null, xstat, true))
          } else {
            callback(err)
          }
        })
      } else if (err) {
        callback(err)
      } else {
        readXstat(dirPath, callback)
      }
    })
  } else if (resolve === 'rename') { // auto rename
    fs.mkdir(dirPath, err => {
      if (err && err.code === 'EEXIST') {
        let dirname = path.dirname(dirPath)
        let basename = path.basename(dirPath)
        fs.readdir(dirname, (e, names) => {
          if (e && e.code === 'ENOTDIR') {
            callback(err)
          } else if (e) {
            err.xcode = 'EAGAIN'
            callback(err)
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
  } else { // vanilla
    fs.mkdir(dirPath, err => {
      if (err && err.code === 'EEXIST') {
        fs.lstat(dirPath, (e, stat) => {
          if (e) {
            err.xcode = 'EAGAIN'
          } else if (stat.isDirectory()) {
            err.xcode = 'ECONFLICT'     
          }
          callback(err)
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

/**
*/
const stageExtFile = (extPath, tmpPath, callback) => {
//  fs.createReadStream(extPath, 'r
}

module.exports = {
  mkdir,
  cloneFile,
  commitFile,
}










