const path = require('path')
const fs = require('fs')

const compare = (a, b) => a.name.localeCompare(b.name)

/**
This is an asynchronous recursive function

last is an exclusive path (excluding the current dir).

It is the parent dir's responsibility to add or bypass child to result.

@param {string} root - root dir path
@param {string[]} namepath - split path string relative to root, this is a recursive variable
@param {string} token - find token
@param {number} maxCount - number
@param {object|null} last - 
@param {string} last.type - 'directory' or 'file'
@param {string[]} last.namepath - split path string
@param {object[]} result - recursive variable
*/
const find = (root, namepath, token, maxCount, last, result, callback) =>
  fs.readdir(path.join(root, ...namepath), (err, entries) => {
    if (err || entries.length === 0) return callback(null, result)
    let count = entries.length
    let arr = []
    entries.forEach(name => {
      fs.lstat(path.join(root, ...namepath, name), (err, stat) => {
        if (!err) {
          let type = stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : null
          if (type) arr.push({ type, name, namepath: [...namepath, name] })
        }

        if (!--count) {
          if (arr.length === 0) return callback(null, result)
          let dirs = arr.filter(x => x.type === 'directory').sort(compare)
          let files = arr.filter(x => x.type === 'file').sort(compare)
          if (last && last.namepath.length) {
            if (last.namepath.length > 1 || (last.namepath.length === 1 && last.type === 'directory')) {
              let index = dirs.findIndex(x => x.name.localeCompare(last.namepath[0]) >= 0)
              dirs = index === -1 ? [] : dirs.slice(index) 
            } else {
              dirs = []
              let index = files.slice(files.findIndex(x => x.name.localCompare(last.namepath[0]) >= 0))
              files = index === -1 ? [] : files.slice(index)
            }
          }

          let i = 0 // for loop dirs in callback form
          const loopDir = () => {
            if (i < dirs.length) {
              if (dirs[i].name.includes(token) &&
                !(i === 0 && last && last.namepath.length && dirs[i].name === last.namepath[0])) {
                result.push(dirs[i])
                if (result.length >= maxCount) return callback(null, result)
              }

              find(root, dirs[i].namepath, token, maxCount, last ? {
                type: last.type,
                namepath: last.namepath.slice(1)
              } : null, result, () => {
                if (result.length >= maxCount) return callback(null, result)
                i++
                loopDir()
              })
            } else {
              for (let i = 0; i < files.length; i++) { // loop file
                if (files[i].name.includes(token) &&
                  !(i === 0 && last && last.namepath.length === 1 && files[i].name === last.namepath[0])) {
                  result.push(files[i])
                  if (result.length >= maxCount) return callback(null, result)
                }
              }
              callback(null, result)
            }
          }
          loopDir()
        }
      })
    })
  })


module.exports = (root, token, maxCount, last, callback) => 
  find(root, [], token, maxCount, last, [], callback)

