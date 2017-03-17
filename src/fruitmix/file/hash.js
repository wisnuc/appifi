import path from 'path'
import fs from 'fs'
import EventEmitter from 'events'
import E from '../lib/error'


import command from '../lib/command'
import { isSHA256 } from '../lib/types'
import { updateFileHash } from './xstat'

class HashWorker extends EventEmitter {

  constructor(fpath, uuid) {
    super()
    this.fpath = fpath
    this.uuid = uuid

    this.finished = false
    this.cmd = undefined
  }

  finalize() {
    if (this.cmd) {
      this.cmd.abort()
      this.cmd = undefined
    }
    this.finished = true
  }

  error(e) {
    this.emit('error', e)
    this.finalize()
  }

  finish(data) {
    this.emit('finish', data)
    this.finalize()
  }

  start() {
 
    if (this.finished) throw 'hash worker already finished' 

    let mtime

    fs.lstat(this.fpath, (err, stats) => {
      if (this.finished) return
      if (err) return callback(err)
      if (!stats.isFile()) return callback(new E.ENOTFILE())
      
      mtime = stats.mtime.getTime()
      cmd = command(cmd, args, (err, data) => {
        if (aborted) return
        if (err) return err

        hash = data.toString().trim().split(' ')[0]
        if (!isSHA256(hash)) return callback(new E.BADFORMAT())

        fs.lstat(target, (err, stats) => {
          if (aborted) return
          if (err) return callback(err)
          if (!stats.isFile()) return callback(new E.ENOTFILE()) 
          if (mtime !== stats.mtime.getTime()) return callback(new E.E)
          updateFileHash(target, uuid, hash, htime, (err, xstat) => {
            if (aborted) return 
            callback(err, xstat)
          })
        })
      })
    })
  }
}

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

