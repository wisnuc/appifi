const path = require('path')
const fs = require('fs')

const compare = (a, b) => a.localeCompare(a.name, b.name)

/**
This is an asynchronous recursive function

last is an exclusive path (excluding the current dir).

It is the parent dir's responsibility to add or bypass child to result.

@param {string} pdir - parent dir path
@param {string} name - current dir name
@param {string} token - find token
@param {number} maxCount - number
@param {string[]} last - split path
@param {string} lastType - directory or file
@param {object[]} result - []
*/
const find = (root, namepath, token, maxCount, last, lastType, result, callback) =>
  fs.readdir(path.join(root, ...namepath), (err, entries) => {
    if (err || entries.length === 0) return callback()
    let count = entries.length
    let arr = []
    entries.forEach(name => {
      fs.lstat(path.join(root, ...namepath, name), (err, stat) => {
        if (!err) {
          let type = stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : null
          if (type) arr.push({ type , name, namepath: [...namepath, name] })
        }

        if (!--count) {
          if (arr.length === 0) return callback()
          let dirs = arr.filter(x => x.type === 'directory').sort(compare)
          let files = arr.filter(x => x.type === 'file').sort(compare)
          if (last.length) {
            if (last.length > 1 || last.length === 1 && lastType === 'directory') {
              dirs = dirs.slice(dirs.findIndex(x => x.name.localeCompare(last[0]) >= 0))
            } else {
              dirs = []
              files = files.slice(files.findIndex(x => x.name.localCompare(last[0]) >= 0))
            }
          }

          let i = 0 // for loop dirs in callback form
          const loopDir = () => {
            if (i < dirs.length) {
              if (dirs[i].name.includes(token) 
                && !(i === 0 && last.length && dirs[i].name === last[0])) {
                result.push(dirs[i])
                if (result.length >= maxCount) return callback()
              }

              find(root, dirs[i].namepath, token, maxCount, last.slice(1), lastType, result, () => {
                if (result.length >= maxCount) return callback()
                i++
                loopDir()
              })
            } else {
              for (let i = 0; i < files.length; i++) {
                if (files[i].name.includes(token) 
                  && !(i === 0 && last.length === 1 && files[i].name === last[0])) {
                  result.push(file[i])
                  if (result.length >= maxCount) return callback()
                }
              }
              callback()
            }
          }
          loopDir()
        }
      })
    })
  })

module.exports = find
