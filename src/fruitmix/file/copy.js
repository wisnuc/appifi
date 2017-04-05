import path from 'path'
import fs from 'fs'
import child from 'child_process'

import E from '../lib/error'
import Worker from '../lib/worker'

class Copy extends Worker {
  constructor(src, dst) {
    super()
    this.src = src
    this.dst = dst
  }

  cleanUp() {

  }

  run() {
    let srcType = isFruitmix(this.src)
    let dstType = isFruitmix(this.dst)
    let modeType = srcType && dstType ? 'FF' : srcType && !dstType ?
                    'FE' : !srcType && dstType ? 'EF' : 'EE'
    switch(modeType){
      case 'FF':
      case 'EF'://probe
        break
      case 'FE':
      case 'EE':
        break
    }
  }

  copy(callback) {
    child.exec(`cp -r --reflink=auto ${ this.src } ${ this.dst }`,(err, stdout, stderr) => {
      if(err) return callback(err)
      if(stderr) return callback(stderr)
      return callback(null, stdout)
    })
  }

}