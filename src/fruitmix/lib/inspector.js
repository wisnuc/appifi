import path from 'path'
import fs from 'fs'

const ERROR = (code, _text) => 
  ((cb, text) => cb(Object.assign(new Error(text || _text), { code })))
  
const ENOTDIR = ERROR('ENOTDIR', 'not a directory')
const EMISMATCH = ERROR('EMISMATCH', 'uuid mismatch')
const EAGAIN = ERROR('EAGAIN', 'try again')

const inspect = (node, callback) => {

  let abort = false

  let target = node.namepath()

  // first check xstat
  readXstat(target, (err, xstat) => {
    
    if (abort) return
    if (err) return callback(err)
    if (xstat.uuid !== uuid) return EMISMATCH(callback)

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
        if (xstat2.uuid !== uuid) return EMISMATCH(callback)
        if (xstat2.mtime.getTime() !== timestamp) 
          return error('timestamp changed during operation', EAGAIN)

         

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
