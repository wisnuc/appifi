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
const find = (root, namepath, token, maxCount, last, lastType, result, callback) => {
  let dirpath = path.join(root, ...namepath)

  fs.readdir(dirpath, (err, entries) => {
    if (err) {
      callback()
    } else {
      if (entries.length === 0) {
        callback()
      } else {
        let count = entries.length
        let arr = []
        entries.forEach(name => {
          let childPath = path.join(dirpath, name)

          fs.lstat(childPath, (err, stat) => {
            if (!err) {
              if (stat.isDirectory()) {
                arr.push({ type: 'directory', name, namepath: [...namepath, name] })
              } else if (stat.isFile()) {
                arr.push({ type: 'file', name, namepath: [...namepath, name] })
              }
            }

            if (!--count) {
              if (arr.length === 0) {
                callback()
              } else {
                let dirs = arr.filter(x => x.type === 'directory').sort(compare)
                let files = arr.filter(x => x.type === 'file').sort(compare)

                // shake off 
                if (last.length) {
                  if (last.length > 1 || last.length === 1 && lastType === 'directory') {
                    dirs = dirs.slice(dirs.findIndex(x => x.name.localeCompare(last[0]) >= 0))
                  } else {
                    dirs = []
                    files = files.slice(files.findIndex(x => x.name.localCompare(last[0]) >= 0))
                  }
                } 

                // for loop dirs in callback form
                let i = 0
                const loopDir = () => {
                  if (i < dirs.length) {
                    let dir = dirs[i]
                    if (dir.name.includes(token)) {
                      if (i === 0 && last.length && dir.name === last[0]) {
                        // bypass last dir
                      } else {
                        // add to result
                        result.push(dir)
                        if (result.length >= maxCount) return callback()
                      }
                    }

                    find(root, dir.namepath, token, maxCount, last.slice(1), lastType, result, () => {
                      if (result.length >= maxCount) return callback()
                      // continue loop dir
                      i++
                      loopDir()
                    })
                  } else {
                    for (let i = 0; i < files.length; i++) {
                      let file = files[i]
                      if (file.name.includes(token)) {
                        if (i === 0 && last.length === 1 && file.name === last[0]) {
                          // bypass last file
                        } else {
                          // add to result
                          result.push(file)
                          if (result.length >= maxCount) return callback()
                        }
                      } 
                    } 
                    callback()
                  }
                }

                loopDir()
              }
            }
          })
        })
      }
    }
  })
}

module.exports = find
