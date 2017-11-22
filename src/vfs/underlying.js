const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const { readXstat, forceXstat } = require('../lib/xstat')
const btrfs = require('../lib/btrfs')
const autoname = require('../lib/autoname') 

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
de
1: fs.mkdir returns just EEXIST irrelevent to file type.
2: if parent ERROR, such as ENOTDIR or ENOENT, vfs is interested on such error. But unable to diff.

opt: null or undefined, 'keep', 'replace', 'rename'

@param {string} dirPath - directory path to make
@param {string} opt - `keep`, `rename`, or else. How to resolve a name conflict
@param {function} callback - `(err, xstat, resolved) => {}`
*/


/**
This function is an internal function to create a new link for file or directory.

The function is intended to resolve name conflict in one place.

A hash/fingerprint value can be provided if the tmp file is a regular file.

uuid is used for recursion when opt is replace.

for file
link(target, tmp, (uuid), (hash), opt, callback)

for directory
link(target, null, (uuid), null, opt, callback)

*/ 
const link1 = (target, tmp, uuid, hash, opt, callback) => {
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

/**
opt is a 2-tuple, [same, diff]

same can be (null | undefined), skip, replace, rename
diff can be (null | undefined), skip, replace, rename

callback has (err, xstat, resolved)

resolved is also a 2-tuple of boolean value. 

If the file exists and is resolved by the first rule, 

*/
const link2 = (target, tmp, uuid, hash, opt, callback) => {
  const type = tmp ? 'file' : 'directory'
  const f = tmp
    ? cb => forceXstat(tmp, { uuid, hash }, (err, xstat) => err ? cb(err) : fs.link(tmp, target, cb))
    : cb => fs.mkdir(target, cb)

  f(err => {

    if (err && err.code === 'EEXIST') {                   // conflict
      readXstat(target, (xerr, xstat) => {
        // return the error we cannot handle
        if (xerr && xerr.xcode !== 'EUNSUPPORTED') return callback(xerr)

        const diff = () => !!xerr || xstat.type !== type  // !!xerr makes sure boolean value
        const same = () => !xerr && xstat.type === type

        if (same() && opt[0] === 'skip') {
          callback(null, xstat, [true, false])
        } else if (diff() && opt[1] === 'skip') {
          // there is no use for xstat when skipping diff
          callback(null, null, [false, true]) 
        } else if (same() && opt[0] === 'rename' || diff() && opt[1] === 'rename') {
          let dirname = path.dirname(target)
          let basename = path.basename(target)
          fs.readdir(dirname, (error, files) => { 
            if (error) return callback(error)
            let target2 = path.join(dirname, autoname(basename, files))
            link(target2, tmp, uuid, hash, opt, (err, xstat) => {
              if (err) return callback(error)
              callback(null, xstat, [same(), diff()])
            })
          })
        } else if (same() && opt[0] === 'replace' || diff() && opt[1] === 'replace') {
          rimraf(target, error => {
            if (error) return callback(error)

            // be careful for replace special file
            let uuid = xerr ? null : xstat.uuid
            link(target, tmp, uuid, hash, opt, (error, xstat) => {
              if (error) return callback(error)
              callback(null, xstat, [same(), diff()])
            })
          })
        } else {
          if (xerr) {
            err.xcode = xerr.code
          } else {
            err.xcode = xstat.type === 'directory' ? 'EISDIR' : 'EISFILE'
          }
          callback(err)
        }

      })
    } else if (err) {                                     // failed
      callback(err)
    } else {                                              // successful
      if (type === 'directory' && uuid) {
        forceXstat(target, { uuid }, (err, xstat) => 
          err ? callback(err) : callback(null, xstat, [false, false]))
      } else {
        readXstat(target, (err, xstat) => 
          err ? callback(err) : callback(null, xstat, [false, false]))
      }
    }

  })
}

const link = link2
const mkdir = (target, opt, callback) => link(target, null, null, null, opt, callback)
const mkfile = (target, tmp, hash, opt, callback) => link(target, tmp, null, hash, opt, callback) 

/**
Clone a file from fruitmix to tmp dir.

file uuid and timestamp are verified. xattr are stripped.
*/
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

//
// exactly the same pattern with link
// 
const createExWriteStream = (target, opt, callback) => 
  fs.open(target, 'wx', (err, fd) => {
    if (err && err.code === 'EEXIST') {
      if (opt === 'rename') {
        let dirname = path.dirname(target)
        let basename = path.basename(target)
        fs.readdir(dirname, (error, files) => {
          if (error) return callback(error)
          let target2 = path.join(dirname, autoname(basename, files))
          openwx(target2, opt, (err, ws) => err ? callback(err) : callback(null, ws, true))
        })
      } else {
        fs.lstat(target, (err, stat) => {
          if (error) {
            return callback(error)
          } else {
            if (stat.isFile() && opt === 'keep') {
              callback(null, null, true) 
            } else if (stat.isFile() && opt === 'replace') {
              rimraf(target, error => {
                if (error) return callback(error)
                openwx(target, opt, (err, ws) => err ? callback(err) : callback(null, ws, true)) 
              })
            } else {

              // the following code are duplicate from that in lib/xstat
              /** from nodejs 8.x LTS doc
              stats.isFile()
              stats.isDirectory()
              stats.isBlockDevice()
              stats.isCharacterDevice()
              stats.isSymbolicLink() (only valid with fs.lstat())
              stats.isFIFO()
              stats.isSocket()
              */
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
    } else if (err) {
      callback(err)
    } else {
      callback(null, createWriteStream(null, { fd }), false) 
    }
  })

/**
Send tmp file to (external) target
*/
const send = (target, tmp, opt, callback) => {
  let size, rs, ws, destroyed = false
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    if (ws) {
      ws.removeAllListeners()
      ws.on('error', () => {})
      rs.removeAllListeners()
      rs.on('error', () => {})
      rs.unpipe()
      ws.destroy()
      rs.destroy()
      ws = null
    }
  }

  // retrieve tmp size
  fs.lstat(tmp, (err, stat) => {
    if (destroyed) return
    if (err) return callback(err) 
    size = stat.size
    createExWriteStream(target, opt, (err, _ws, resolved) => {
      if (destroyed) return
      if (err) return callback(err) 
      ws = _ws
      rs = fs.createReadStream(tmp)       
      rs.on('error', err => (destroy(), callback(err)))
      ws.on('error', err => (destroy(), callback(err)))
      ws.on('finish', () => {
        let { path, bytesWritten } = ws
        ws = null
        callback(null, { path, bytesWritten }, resolved)
      })
    })
  })

  let obj = { destroy } 
  Object.defineProperty(obj, 'size', { get: () => size })
  Object.defineProperty(obj, 'bytesWritten', { get: () => ws ? ws.bytesWritten : 0 })
  return obj
}

/**
Receive copies an external target file into tmp dir
*/
const receive = (target, tmp, callback) => {
  fs.lstat(target, (err, stat) => {
    if (destroyed) return
    if (err) return callback(err)
    if (!stat.isFile()) {
      let err = new Error('target is not a regular file')

      // the following code are duplicate from that in lib/xstat
      /** from nodejs 8.x LTS doc
      stats.isDirectory()
      stats.isBlockDevice()
      stats.isCharacterDevice()
      stats.isSymbolicLink() (only valid with fs.lstat())
      stats.isFIFO()
      stats.isSocket()
      */
      if (stat.isDirectory()) {
        err.code = 'EISDIR'
      } else if (stat.isBlockDevice()) {
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

      return callback(err)
    }

    size = stat.size
    time = stat.mtime.getTime()

    rs = fs.createReadStream(target)
    ws = fs.createWriteStream(tmp)
    rs.on('error', err => (destroy(), callback(err)))
    ws.on('error', err => (destroy(), callback(err)))
    ws.on('finish', () => {
        
    })
  })
}

module.exports = {
  link,                   // internal
  mkdir,
  mkfile,
  clone,
  createExWriteStream,    // internal
  send,
  receive,
}



