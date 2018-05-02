const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const autoname = require('../../lib/autoname')

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

const mkdir = (target, policy, callback) => {
  fs.mkdir(target, err => {
    if (err && err.code === 'EEXIST') {
      fs.lstat(target, (error, stat) => {
        if (error) return callback(error)

        const same = stat.isDirectory()
        const diff = !same

        if ((same && policy[0] === 'skip') || (diff && policy[1] === 'skip')) {
          callback(null, null, [same, diff])
        } else if (same && policy[0] === 'replace' || diff && policy[1] === 'replace') {
          rimraf(target, err => {
            if (err) return callback(err)
            mkdir(target, policy, err => {
              if (err) return callback(err)
              callback(null, null, [same, diff])
            })
          }) 
        } else if (same && policy[0] === 'rename' || diff && policy[1] === 'rename') {
          let dirname = path.dirname(target)
          let basename = path.basename(target)
          fs.readdir(dirname, (error, files) => {
            if (error) return callback(error)
            let target2 = path.join(dirname, autoname(basename, files))
            mkdir(target2, policy, (err, fd) => {
              if (err) return callback(err)
              callback(null, target2, [same, diff])
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
      callback(null, null, [false, false])
    }
  }) 
}


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

module.exports = {
  mkdir,
  openwx
}
