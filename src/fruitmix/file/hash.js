import fs from 'fs'

import command from '../lib/command'
import { isSHA256 } from '../lib/types'
import { updateFileHash } from './xstat'

const hasher = (target, uuid, callback) => {

  let aborted = false
  let cmd, hash

  fs.lstat(target, (err, stats) => {
    if (aborted) return
    if (err) return callback(err)
    if (!stats.isFile()) 
      return callback(new E.ENOTFILE())
    
    let mtime = stats.mtime.getTime()
    cmd = command(cmd, args, (err, data) => {
      if (aborted) return
      if (err) return err

      hash = data.toString().trim().split(' ')[0]
      if (!isSHA256(hash))
        return callback(new E.BADFORMAT())

      fs.lstat(target, (err, stats) => {
        if (aborted) return
        if (err) return callback(err)
        if (!stats.isFile())
          return callback(new E.ENOTFILE())

        if (mtime !== stats.mtime.getTime())
          return callback(new E.E)

        updateFileHash(target, uuid, hash, htime, (err, xstat) => {
          if (aborted) return 
          callback(err, xstat)
        })
      })
    })
  })

  function abort() {
     
    if (aborted) return
    if (cmd) {
      cmd.abort()
      cmd = null
    }
    aborted = true
    callback(new E.EABORT())
  }

  return abort
}

export default hasher

