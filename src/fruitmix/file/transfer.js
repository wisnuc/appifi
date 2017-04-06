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

  isPadding() {
    return this.state === 'PADDING'
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
  constructor(src, dst, data) {
    super()
    this.src = src
    this.dst = dst
    this.data = data
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

            let srcNode = this.data.findNodeByUUID(path.basename(this.src))
            let dstNode = this.data.findNodeByUUID(path.basename(this.dst))
            if(srcNode)
              this.data.requestProbeByUUID(srcNode.parent)
            if(dstNode)
              this.data.requestProbeByUUID(dstNode.uuid)

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

            let dstNode = this.data.findNodeByUUID(path.basename(this.dst))
            if(dstNode)
              this.data.requestProbeByUUID(dstNode.uuid)
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
  constructor(src, dst, tmp, data) {
    super()
    this.src = src
    this.dst = dst
    this.tmp = tmp
    this.data = data
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
        if(modeType === 'FF') {
          let srcNode = this.data.findNodeByUUID(path.basename(this.src))
          let dstNode = this.data.findNodeByUUID(path.basename(this.dst))
          if(srcNode)
            this.data.requestProbeByUUID(srcNode.parent)
          if(dstNode)
            this.data.requestProbeByUUID(dstNode.uuid)
        } //probe src dst
        if(modeType === 'EF') {
          let dstNode = this.data.findNodeByUUID(path.basename(this.dst))
          if(dstNode)
            this.data.requestProbeByUUID(dstNode.uuid)
        }//probe dst
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
  constructor(data) {
    this.workersQueue = []
    this.warningQueue = []
    this.limit = 1
    this.data = data
  }

  schedule() {
    let diff = limit - this.workersQueue.filter(worker => worker.isRunning()).length
    if (diff <= 0) return

    this.workersQueue.filter(worker => !worker.isRunning())
      .slice(0, diff)
      .forEach(worker => worker.start())
  }
  
  createMove(src, dst, callback) {
    createMoveWorker(src, dst, this.data, (err, worker) => {
      if(err) return callback(ett)
      worker.on('finish', worker => {
        worker.state = 'FINISHED'
        this.schedule()
      })
      worker.on('error', worker => {
        worker.state = 'WARNING'
        this.workersQueue.splice(this.warningQueue.indexOf(worker), 1)
        this.warningQueue.push(worker)
        this.schedule()
      })
      this.workersQueue.push(worker)
      callback(null, worker)
      this.schedule()
    })
  }

  createCopy(src, dst, callback) {
    createCopyWorker(src, dst, this.data, (err, worker) => {
      if(err) return callback(err)
      worker.on('finish', worker => {
        worker.state = 'FINISHED'
        this.schedule()
      })
      worker.on('error', worker => {
        worker.state = 'WARNING'
        this.workersQueue.splice(this.warningQueue.indexOf(worker), 1)
        this.warningQueue.push(worker)
        this.schedule()
      })
      this.workersQueue.push(worker)
      callback(null, worker)
      this.schedule()
    })
  }

}


const createMoveWorker = (src, dst, data, callback) => {
  if(fs.existsSync(src) && fs.existsSync(dst)) {
    let worker = new Move(src, dst, data)
    return callback(null, worker)
  }
  return callback(new Error('path not exists'))
}

const createCopyWorker = (src, dst, data, callback) => {
  let tmp = path.join(process.cwd(), 'tmp') //TODO Get tmp folder
  if(fs.existsSync(src) && fs.existsSync(dst)) {
    let worker = new Copy(src, dst, tmp, data)
    return callback(null, worker)
  }
  return callback(new Error('path not exists'))
}

export default Transfer