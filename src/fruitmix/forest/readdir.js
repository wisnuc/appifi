const fs = require('fs')
const { readXstat } = require('../file/xstat')

/**

@param {string} dirPath - directory's absolute path
@param {string} uuid - directory's uuid
@param {function} callback
*/
const Readdir = (dirPath, uuid, callback) => {

  let finished = false

  const error = (err, code) => {
    finished = true
    err.code = code
    callback(err)
  }

  const finish = (xstats, mtime, transient) => {
    finished = true
    callback(null, xstats, mtime, transient)
  }

  const readXstats = callback => {
    let count, xstats = []
    fs.readdir(dirPath, (err, entries) => 
      finished ? undefined
        : err ? callback(err)
        : (count = entries.length) === 0 ? callback(null, [])     
        : entries.forEach(ent => 
          readXstat(path.join(dirPath, ent), (err, xstat) => {
            if (finished) return
            if (!err) xstats.push(xstat)
            if (!--count) 
              callback(null, xstats.sort((a,b) => a.name.localeCompare(b.name)))
          })))
  }

  readXstat(dirPath, (err, xstat1) =>                                   // read xstat1
    finished ? undefined
    : err ? error(err)
    : xstat1.type !== 'directory' ? error(new Error('not a dir'), 'ENOTDIR')
    : xstat1.uuid !== uuid ? error(new Error('uuid mismatch'), 'EINSTANCE')
    : readXstats((err, xstats) => 
      finished ? undefined
      : err ? error(err) 
      : readXstat(dirPath, (err, xstat2) =>                             // read xstat2
        finished ? undefined
        : err ? error(err)
        : xstat2.type !== 'directory' ? error(new Error('not a dir'), 'ENOTDIR')
        : xstat2.uuid !== uuid ? error(new Error('uuid mismatch'), 'EINSTANCE') 
        : finish(xstats, xstat2.mtime, xstat2.mtime !== xstat1.mtime))))

  return () => finished || error(new Error('aborted'), 'EABORT')
}

module.exports = Readdir

