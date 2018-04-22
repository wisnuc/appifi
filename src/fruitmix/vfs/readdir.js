const path = require('path')
const fs = require('fs')
const { readXstat } = require('../../lib/xstat')

const readdir = (dirPath, uuid, mtime, callback) => {
  // guard
  let destroyed = false

  readXstat(dirPath, (err, x1) => {
    if (destroyed) return 
    if (err) return callback(err)
    if (x1.type !== 'directory') {
      callback(Object.assign(new Error('not a directory'), { code: 'ENOTDIR' }))
    } else if (x1.uuid !== uuid) {
      callback(Object.assign(new Error('uuid mismatch'), { code: 'EINSTANCE' }))
    } else if (mtime && x1.mtime === mtime) {
      callback(null, null)
    } else {
      fs.readdir(dirPath, (err, entries) => {
        if (destroyed) return
        if (err) return callback(err)
        if (entries.length === 0)  {
          readXstat(dirPath, (err, x2) => {
            if (destroyed) return
            if (err) return callback(err)
            if (x2.type !== 'directory') {
              callback(Object.assign(new Error('not a directory'), { code: 'ENOTDIR' }))
            } else if (x2.uuid !== uuid) {
              callback(Object.assign(new Error('uuid mismatch'), { code: 'EINSTANTCE' }))
            } else {
              callback(null, [], x2.mtime, x2.mtime !== x1.mtime)
            }
          })
        } else {
          let names = entries.sort()
          let running = 0
          let xstats = []
          const schedule = () => {
            while (names.length > 0 && running < 16) {
              let name = names.shift()
              readXstat(path.join(dirPath, name), (err, xstat) => {
                if (destroyed) return
                if (!err) xstats.push(xstat)
                if (--running || names.length) {
                  schedule() 
                } else {
                  readXstat(dirPath, (err, x2) => {
                    if (destroyed) return
                    if (err) return callback(err)
                    if (x2.type !== 'directory') {
                      callback(Object.assign(new Error('not a directory'), { code: 'ENOTDIR' }))
                    } else if (x2.uuid !== uuid) {
                      callback(Object.assign(new Error('uuid mismatch'), { code: 'EINSTANCE' }))
                    } else {
                      callback(null, xstats, x2.mtime, x2.mtime !== x1.mtime)
                    }
                  }) 
                }
              })
              running++
            }
          } 
          
          schedule()
        }
      })   
    }
  })

  return {
    path: dirPath,
    destroy: () => destroyed = true
  } 
}

module.exports = readdir







