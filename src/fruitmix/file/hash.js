import path from 'path'
import fs from 'fs'
import EventEmitter from 'events'
import E from '../lib/error'

import command from '../lib/command'
import { isSHA256 } from '../lib/types'
import { updateFileHash } from './xstat'

class Worker extends EventEmitter {

  constructor() {
    super()
    this.finished = false
  }

  cleanup() {
  }

  finalize() {
    this.cleanup() 
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
    if (this.finished) throw 'worker already finished'
    this.run()
  }

  abort() {
    if (this.finished) throw 'worker already finished'
    this.emit('error', new E.EABORT())
    this.finalize()
  }
}

class HashWorker extends Worker {

  constructor(fpath, uuid) {
    super()
    this.fpath = fpath
    this.uuid = uuid
    this.cmd = undefined
  }

  cleanup() {
    if (this.cmd) this.cmd()
  }

  run() {

    let hash

    fs.lstat(this.fpath, (err, stats) => 
      this.finished ? undefined
        : err ? this.error(err)
          : !stats.isFile() ?  this.error(new E.ENOTFILE())
            : this.cmd = command('openssl', ['dgst', '-sha256', '-r', this.fpath], (err, data) => 
                this.finished ? undefined
                  : err ? this.error(err)
                    : !isSHA256(hash = data.toString().trim().split(' ')[0]) ? this.error(new E.FORMAT())
                      : fs.lstat(this.fpath, (err, stats2) => 
                          this.finished ? undefined
                            : err ? this.error(err)
                              : !stats.isFile() ? this.error(new E.ENOTFILE()) 
                                : stats.mtime.getTime() !== stats2.mtime.getTime() ? this.error(new E.ETIMESTAMP())
                                  : updateFileHash(this.fpath, this.uuid, hash, stats.mtime.getTime(), (err, xstat) => 
                                      this.finished ? undefined
                                        : err ? this.error(err)
                                          : this.finish(xstat)))))
  }
}

export default (fpath, uuid) => new HashWorker(fpath, uuid)


