import path from 'path'
import fs from 'fs'
import child from 'child_process'
import EventEmitter from 'events'

import xattr from 'fs-xattr'
import UUID from 'node-uuid'

import E from '../lib/error'

class Worker extends EventEmitter {

  constructor() {
    super()
    this.finished = false
    this.state = 'PADDING'
    this.id = UUID.v4()
  }

  cleanUp() {
  }

  finalize() {
    this.cleanUp() 
    this.finished = true
  }

  error(e, ...args) {
    this.emit('error', e, ...args)
    this.finalize()
  }

  finish(data, ...args) {
    this.emit('finish', data, ...args)
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

  isRunning() {
    return this.state === 'RUNNING'
  }


}

/**
 * state:
 * PADDING
 * RUNNING
 * FINISHED
 * WARNING
 */

class Move extends Worker {
  constructor(src, dst) {
    super()
    this.src = src
    this.dst = dst
  }

  cleanUp() {

  }

  run() {
    if(this.state !== 'PADDING') return 

    let srcType = isFruitmix(this.src)
    let dstType = isFruitmix(this.dst)
    let modeType = srcType && dstType ? 'FF' : srcType && !dstType ?
                    'FE' : !srcType && dstType ? 'EF' : 'EE'
    switch(modeType){
      case 'FF':
      case 'FE':
        this.copy(err => {
          if(this.finished) return 
          if(err) return this.error(err)
          this.delete(err => {
            if(this.finished) return 
            if(err) return this.error(err)
            return this.finish(this)//TODO probe
          })
        })
        break
      case 'EF':
        this.cleanXattr(err => {
          if(this.finished) return 
          if(err) return this.error(err)
          this.move(err => {
            if(this.finished) return 
            if(err) return this.error(err)
            return this.finish(this)
          })
        })
        break
      case 'EE':
        this.move(err => {
          if(this.finished) return 
          if(err) return this.error(err)
          return this.finish(this)
        })
    }
  }

  copy(callback) {
    child.exec(`cp -r --reflink=auto ${ this.src } ${ this.dst }`,(err, stdout, stderr) => {
      if(err) return callback(err)
      if(stderr) return callback(stderr)
      return callback(null, stdout)
    })
  }

  delete(callback) {
    child.exec(`rm -rf ${ this.src }`, (err, stdout, stderr) => {
      if(err) return callback(err)
      if(stderr) return callback(stderr)
      return callback(null, stdout)
    })
  }

  // visitor tree dump xattr
  cleanXattr(callback){
    const clean = (dir, dirContext, entry, callback) => {
      let xattrType = dirContext.type
      let path = path.join(dir, entry)
      xattr.setSync(path, xattrType, JSON.stringify({}))
      fs.lstatSync(path).isFile() ? callback() : callback(dirContext)
    }
    this.visit(this.src, { type: 'user.fruitmix'}, clean, callback)
  }

  move(callback){
    child.exec(`mv -f ${ this.src } ${ this.dst }`, (err, stdout, stderr) => {
      if(err) return callback(err)
      if(stderr) return callback(stderr)
      return callback(null, stdout)
    })
  }

  visit(dir, dirContext, func, done) { 
    fs.readdir(dir, (err, entries) => {
      if (err || entries.length === 0) return done()
      
      let count = entries.length
      entries.forEach(entry => {

        func(dir, dirContext, entry, (entryContext) => {
          if (entryContext) {
            visit(path.join(dir, entry), entryContext, func, () => {
              count--
              if (count === 0) done()
            })
          }
          else {
            count --
            if (count === 0) done()
          }
        })
      })
    })
  }

}

class Copy extends Worker {
  constructor(src, dst, tmp) {
    super()
    this.src = src
    this.dst = dst
    this.tmp = tmp
  }

  cleanUp() {

  }

  run() {
    if(this.state !== 'PADDING') return 
    this.state = 'RUNNING'
    let srcType = isFruitmix(this.src)
    let dstType = isFruitmix(this.dst)
    let modeType = srcType && dstType ? 'FF' : srcType && !dstType ?
                    'FE' : !srcType && dstType ? 'EF' : 'EE'
    // switch(modeType){
    //   case 'FF':
    //   case 'EF'://probe
    //     break
    //   case 'FE':
    //   case 'EE':
    //     break
    // }
    this.copy(err => {
      if(this.finished) return 
      if(err) return  this.error(err)
      fs.rename(this.tmp, this.dst, err => {
        if(this.finished) return 
        if(err) return  this.error(err)
        // if(modeType === 'FF') //probe src dst
        // if(modeType === 'EF') //probe dst
        return this.finish(this)
      })
    })
  }

  copy(callback) {
    child.exec(`cp -r --reflink=auto ${ this.src } ${ this.tmp }`,(err, stdout, stderr) => {
      if(err) return callback(err)
      if(stderr) return callback(stderr)
      return callback(null, stdout)
    })
  }

}


class Transfer {
  constructor() {
    this.workersQueue = []
    this.warningQueue = []
    this.limit = 1
  }

  schedule() {
    let diff = limit - this.workersQueue.filter(worker => worker.isRunning()).length
    if (diff <= 0) return

    this.workersQueue.filter(worker => !worker.isRunning())
      .slice(0, diff)
      .forEach(worker => worker.start())
  }
  
  createMove(src, dst, callback) {
    createMoveWorker(src, dst, (err, worker) => {
      if(err) return callback(ett)
      worker.on('finish', worker => {
        
      })
      worker.on('error', worker => {

      })
      this.workersQueue.push(worker)
      callback(null, worker)
      this.schedule()
    })
  }

  createCopy(src, dst, callback) {
    createCopyWorker(src, dst, (err, worker) => {
      if(err) return callback(err)
      worker.on('finish', worker => {

      })
      worker.on('error', worker => {

      })
      this.workersQueue.push(worker)
      callback(null, worker)
      this.schedule()
    })
  }

}


const createMoveWorker = (src, dst, callback) => {
  if(fs.existsSync(src) && fs.existsSync(dst)) {
    let worker = new Move(src, dst)
    return callback(null, worker)
  }
  return callback(new Error('path not exists'))
}

const createCopyWorker = (src, dst, callback) => {
  let tmp = path.join(process.cwd(), 'tmp') //TODO Get tmp folder
  if(fs.existsSync(src) && fs.existsSync(dst)) {
    let worker = new Copy(src, dst, tmp)
    return callback(null, worker)
  }
  return callback(new Error('path not exists'))
}

