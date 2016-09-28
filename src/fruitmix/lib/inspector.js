import path from 'path'
import fs from 'fs'

// only inspect a folder
// ENOTDIR

// ENOENT
// EMISMATCH

const EMISMATCH = 'EMISMATCH'
const ENOTDIR = 'ENOTDIR'
const EAGAIN = 'EAGAIN'

const inspect = (target, uuid, callback) => {

  const error = (text, code) => callback(Object.assign(new Error(text), { code }))
  let abort = false

  readXstat(target, (err, xstat) => {
    
    if (abort) return
    if (xstat.uuid !== uuid) return error('uuid mismatch', EMISMATCH)
    if (!xstat.isDirectory()) return error('not a directory', ENOTDIR)

    let timestamp = xstat.mtime.getTime()

    // possible errors unknown, EBADF seems not relevant to NodeJS
    // ENOENT is a possible error
    fs.readdir(target, (err, entries) => {
  
      if (abort) return
      if (err) return callback(err)
    
      let count = entries.length  
      let xstats = []
      entries.forEach(entry => {
        readXstat(path.join(target, entry), (err, xstat) => {
          if (abort) return
          if (!err) xstats.push(xstat) // bypass error
          if (!--count) finalize()
        })  
      })
    })

    function finalize() {

      readXstat(target, (err, xstat2) => {
 
        if (abort) return
        if (err) return callback(err)
        if (xstat2.uuid !== uuid) return error('uuid mismatch', EMISMATCH)
        if (!xstat2.isDirectory()) return error('not a directory', ENOTDIR)
        if (xstat2.mtime.getTime() !== timestamp) return error('timestamp changed during operation', EAGAIN)

        callback(null, { timestamp, xstats })
      })      
    }
  })   

  return Object.freeze({ 
    uuid, 
    abort: () => { abort = true }
  }) 
}

export default inspect
