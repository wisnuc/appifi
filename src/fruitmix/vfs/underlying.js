const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

const { readXstat, forceXstat } = require('../../lib/xstat')
const btrfs = require('../../lib/btrfs')
const autoname = require('../../lib/autoname')

/**
opt is a 2-tuple, [same, diff]

same can be (null | undefined), skip, replace, rename
diff can be (null | undefined), skip, replace, rename

callback has (err, xstat, resolved)

resolved is also a 2-tuple of boolean value.

If the file exists and is resolved by the first rule,

@param {string} target - target path
@param {string} tmp - tmp file path, if provided, it is linking a file, otherwise, creating a directory
*/
const link = (target, tmp, uuid, hash, opt, callback) => {
  const type = tmp ? 'file' : 'directory'
  const f = tmp
    ? cb => forceXstat(tmp, { uuid, hash }, (err, xstat) => err ? cb(err) : fs.link(tmp, target, cb))
    : cb => fs.mkdir(target, cb)

  f(err => {
    if (err && err.code === 'EEXIST') {           // conflict
      readXstat(target, (xerr, xstat) => {
        // return the error we cannot handle
        if (xerr && xerr.xcode !== 'EUNSUPPORTED') return callback(xerr)

        const diff = () => !!xerr || xstat.type !== type // !!xerr makes sure boolean value
        const same = () => !xerr && xstat.type === type

        if (same() && opt[0] === 'skip') {
          callback(null, xstat, [true, false])
        } else if (diff() && opt[1] === 'skip') {
          // there is no use for xstat when skipping diff
          callback(null, null, [false, true])
        } else if ((same() && opt[0] === 'rename') || (diff() && opt[1] === 'rename')) {
          let dirname = path.dirname(target)
          let basename = path.basename(target)
          fs.readdir(dirname, (error, files) => {
            if (error) return callback(error)
            let target2 = path.join(dirname, autoname(basename, files))
            link(target2, tmp, uuid, hash, opt, (error, xstat) => {
              if (error) return callback(error)
              callback(null, xstat, [same(), diff()])
            })
          })
        } else if ((same() && opt[0] === 'replace') || (diff() && opt[1] === 'replace')) {
          // fs.unlink does not work on directory
          rimraf(target, error => {
            if (error) return callback(error)

            // be careful for replace special file
            let uuid = (xerr || diff()) ? null : xstat.uuid
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
          err.status = 403
          callback(err)
        }
      })
    } else if (err) { // failed
      callback(err)
    } else { // successful
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

const renameNoReplace = (oldPath, newPath, callback) =>
  // stat parent directory
  fs.lstat(path.dirname(newPath), (err, stat) => {
    if (err) {
      callback(err)
    } else if (!stat.isDirectory()) {
      let err = new Error('parent is not a directory')
      err.code = 'ENOTDIR'
      return callback(err)
    } else {
      // stat target
      fs.lstat(newPath, (err, stat) => {
        if (err && err.code === 'ENOENT') {
          fs.rename(oldPath, newPath, callback)
        } else if (err) {
          callback(err)
        } else {
          let err = new Error('target exist')
          err.code = 'EEXIST'
          callback(err)
        }
      })
    }
  })

let working = false
const rename = (oldPath, newPath, type, opt, callback) =>
  renameNoReplace(oldPath, newPath, err => {
    if (err && err.code === 'EEXIST') { // conflict
      working = false
      readXstat(newPath, (xerr, xstat) => {
        // return the error we cannot handle
        if (xerr && xerr.xcode !== 'EUNSUPPORTED') return callback(xerr)

        const diff = () => !!xerr || xstat.type !== type // !!xerr makes sure boolean value
        const same = () => !xerr && xstat.type === type

        if (same() && opt[0] === 'skip') {
          callback(null, xstat, [true, false])
        } else if (diff() && opt[1] === 'skip') {
          // there is no use for xstat when skipping diff (???)
          callback(null, null, [false, true])
        } else if ((same() && opt[0] === 'rename') || (diff() && opt[1] === 'rename')) {
          let dirname = path.dirname(newPath)
          let basename = path.basename(newPath)

          fs.readdir(dirname, (error, files) => {
            if (error) return callback(error)
            let newPath2 = path.join(dirname, autoname(basename, files))

            let func = () => {
              if (!working) {
                working = true
                rename(oldPath, newPath2, type, opt, (error, xstat) => {
                  if (error) return callback(error)
                  working = false
                  callback(null, xstat, [same(), diff()])
                })
              } else {
                setTimeout(() => {
                  func()
                }, 5)
              }
            }

            func()

            // rename(oldPath, newPath2, type, opt, (error, xstat) => {
            //   if (error) return callback(error)
            //   callback(null, xstat, [same(), diff()])
            // })
          })
        } else if ((same() && opt[0] === 'replace') || (diff() && opt[1] === 'replace')) {
          rimraf(newPath, error => {
            if (error) return callback(error)
            rename(oldPath, newPath, type, opt, (error, xstat) => {
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
    } else if (err) { // failed
      callback(err)
    } else { // successful
      readXstat(newPath, (err, xstat) => {
        if (err) return callback(err)
        callback(null, xstat, [false, false])
      })
    }
  })

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

/**
Send tmp file to (external) target
*/
const send = (tmp, target, opt, callback) => {
  let size, rs, ws
  let destroyed = false
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
  link, // internal
  mkdir: (target, opt, callback) => link(target, null, null, null, opt, callback),
  mkfile: (target, tmp, hash, opt, callback) => link(target, tmp, null, hash, opt, callback),
  mvdir: (oldPath, newPath, opt, callback) => rename(oldPath, newPath, 'directory', opt, callback),
  mvfile: (oldPath, newPath, opt, callback) => rename(oldPath, newPath, 'file', opt, callback),
  clone,
  send,
  receive
}
