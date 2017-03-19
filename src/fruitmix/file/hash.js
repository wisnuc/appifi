import path from 'path'
import fs from 'fs'
import E from '../lib/error'
import Worker from '../lib/worker'
import command from '../lib/command'

import { isSHA256 } from '../lib/types'
import { updateFileHash } from './xstat'

class Hash extends Worker {

  constructor(fpath, uuid) {
    super()
    this.fpath = fpath
    this.uuid = uuid
    this.cmd = undefined
    this.hash = undefined
  }

  cleanUp() {
    this.cmd && this.cmd()
  }

  run() {
    fs.lstat(this.fpath, (err, stats) => 
      this.finished ? undefined
      : err ? this.error(err)
      : !stats.isFile() ?  this.error(new E.ENOTFILE())
      : this.cmd = command('openssl', ['dgst', '-sha256', '-r', this.fpath], (err, data) => 
          this.finished ? undefined
          : err ? this.error(err)
          : !isSHA256(this.hash = data.toString().trim().split(' ')[0]) ? this.error(new E.FORMAT())
          : fs.lstat(this.fpath, (err, stats2) => 
              this.finished ? undefined
              : err ? this.error(err)
              : !stats.isFile() ? this.error(new E.ENOTFILE()) 
              : stats.mtime.getTime() !== stats2.mtime.getTime() ? this.error(new E.ETIMESTAMP())
              : updateFileHash(this.fpath, this.uuid, this.hash, stats.mtime.getTime(), (err, xstat) => 
                  this.finished ? undefined
                  : err ? this.error(err)
                  : this.finish(xstat)))))
  }
}

export default (fpath, uuid) => new Hash(fpath, uuid)


