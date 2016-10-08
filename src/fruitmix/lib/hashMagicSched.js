import fs from 'fs'
import child from 'child_process'
import EventEmitter from 'events'

import { readXstat } from './xstat'

export const createWorker = (target, uuid, callback) => {

  let finished = false

  let timestamp
  let hash = null, magic = null

  let file, openssl
  let count = 2

  readXstat(target, (err, xstat) => {

    if (finished) return
    if (err) 
      return CALLBACK(err)
    if (!xstat.isFile()) 
      return CALLBACK(Object.assign(new Error('target must be a file'), { code: 'ENOTDIR' }))
    if (xstat.uuid !== uuid) 
      return CALLBACK(Object.assign(new Error('uuid mismatch'), { code: 'EMISMATCH' }))
   
    timestamp = xstat.mtime.getTime() 
    
    openssl = child.spawn('openssl', ['dgst', '-sha256', '-r', target])
    openssl.stdout.on('data', data => {
      if (finished) return
      let str = data.toString().trim().slice(0, 64)
      if (/^[0-9a-f]{64}$/.test(str)) hash = str
    })

    openssl.on('close', code => {
      openssl = null
      if (finished) return
      if (code !== 0 || !hash) {
        if (file) file.kill()
        return CALLBACK(Object.assign(new Error('openssl failed'), { code: 'EFAIL' }))
      }
      next()
    }) 

    file = child.spawn('file', ['-b', target])
    file.stdout.on('data', data => {
      if (finished) return
      let str = data.toString().trim()
      if (str.length) magic = str
    })

    file.on('close', code => {
      file = null
      if (finished) return
      if (code !== 0 || !magic) {
        if (openssl) openssl.kill()
        return CALLBACK(Object.assign(new Error('file failed'), { code: 'EFAIL' }))
      }
      next()
    })

  })

  const next = () => {
    if (!--count) {
      this.forest.updateHashMagic(target, uuid, hash, magic, timestamp, err => {
        if (finished) return
        CALLBACK(err)
      })
    }
  }

  const CALLBACK = (err) => {
    finished = true
    callback(err)
  }

  // abort function
  return () => {
    if (finished) return
    if (openssl) {
      openssl.kill() 
      openssl = null
    }
    if (file) {
      file.kill()
      file = null
    }
    CALLBACK(Object.assign(new Error('aborted'), { code: 'EABORT' }))
  }
}

class Scheduler extends EventEmitter {

  constructor(forest, limit = 1) {
    super()
    this.forest = forest
    this.limit = limit
    this.running = [] // object array
    this.pending = [] // uuid array

    this.forest.on('hashless', this.handle)
  }

  createJob(node) {

    let job = {
      uuid: node.uuid,
      abort: createWorker(node.namepath(), uuid, err => this.jobDone(err, job))
    }
    return job
  }

  jobDone(err, job) {
    
    if (err && err.code === 'EABORT') return

    this.running.splice(this.running.indexOf(job), 1)
    process.nextTick(() => this.schedule())
  
    if (!err) return

    let node = this.forest.findNodeByUUID(job.uuid)
    if (!node) return  

    switch(err.code) {
      case 'ENOENT':
        return
      case 'ENOTDIR':
        return
      case 'EMISMATCH':
        return
      case 'EOUTDATED':
        this.handler(node)
        return 
      default:
        // TODO log
        return
    }
  }

  schedule() {

    if (!this.running.length && !this.pending.length)
      this.emit('hashMagicStopped')

    while (this.limit - this.running.length > 0 && this.pending.length) {

      let uuid = this.pending.shift()
      let node = this.forest.findNodeByUUID(uuid)
      if (node) {
        let job = this.createJob(node)

        if (job) {
          this.running.push(job)
        }
      }
    }
  }

  handle(node) {

    // running
    if (this.running.find(r => r.uuid === node.uuid))
      return

    // pending
    if (this.pending.find(id => id === node.uuid))
      return
    
    if (this.running.length >= this.limit) {
      this.pending.push(node.uuid)
    }
    else {
      let job = this.createJob(node)
      if (job) {
        this.running.push(job)
        if (this.running.length === 1 && this.pending.length === 0) {
          this.emit('hashMagicStarted')
        }
      }
    }
    return this
  }

  request(uuid) {

    // running
    if (this.running.find(r => r.uuid === uuid))
      return this

    // pending
    if (this.pending.find(id => id === uuid))
      return this
    
    if (this.running.length >= this.limit) {
      this.pending.push(uuid)
    }
    else {
      let job = this.createJob(uuid)
      if (job) {
        this.running.push(job)
        if (this.running.length === 1 && this.pending.length === 0) {
          this.emit('hashMagicStarted')
        }
      }
    }
    return this
  }

  abort() {
    this.running.forEach(job => job.abort())
    this.running = []
    this.pending = []
  }
}

export const createHashMagicScheduler = (forest, limit) => new Scheduler(forest, limit)





