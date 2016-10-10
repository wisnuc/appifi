import fs from 'fs'
import child from 'child_process'
import EventEmitter from 'events'

import { readXstat, updateXattrHashMagic } from './xstat'

// this function is responsible for update xattr of target file
// and returns xstat after updateXattrHashMagic succeeds.
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
    if (xstat.isDirectory()) 
      return CALLBACK(Object.assign(new Error('target must be a file'), { code: 'EISDIR' }))
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

  const next = () =>   
    !--count && updateXattrHashMagic(target, uuid, hash, magic, timestamp, (err, xstat) => 
      !finished && CALLBACK(err, xstat))

  const CALLBACK = (err, xstat) => (finished = true) && callback(err, xstat)

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

export class HashMagicBuilder extends EventEmitter {

  constructor(filer, limit = 1) {
    super()
    this.filer = filer
    this.limit = limit
    this.running = [] // object array
    this.pending = [] // uuid array

    this.filer.on('hashMagic', node => {
      this.handle(node)
    })
  }

  createJob(node) {

    console.log(`creating job for ${node.uuid}`)

    let uuid = node.uuid
    let abort = createWorker(node.namepath(), uuid, (err, xstat) => 
      this.jobDone(err, xstat, job))

    let job = { uuid, abort }
    this.running.push(job)

  }

  jobDone(err, xstat, job) {

    console.log(`job for ${job.uuid} done`)
  
    if (err) {
      switch (err.code) {
        case 'EABORT':
          break
        default:
          break        
      }
    }
    else {
      this.filer.updateFileNode(xstat)
    }

    this.running.splice(this.running.indexOf(job), 1)
    if (!this.running.length && !this.pending.length) {
      process.nextTick(() => this.emit('hashMagicBuilderStopped'))
    }

    process.nextTick(() => this.schedule())
  }

  schedule() {

    while (this.limit - this.running.length > 0 && this.pending.length) {
      let uuid = this.pending.shift()
      let node = this.filer.findNodeByUUID(uuid)
      if (node) this.createJob(node)
    }
  }

  handle(node) {

    console.log(`hashmagic handle node`)

    if (this.aborted) return

    if (this.running.find(r => r.uuid === node.uuid))
      return
    if (this.pending.find(id => id === node.uuid))
      return
    
    if (this.running.length >= this.limit)
      this.pending.push(node.uuid)
    else {
      this.createJob(node)
      if (this.running.length === 1 && this.pending.length === 0) {
        // using nextTick is stack friendly and safer, say, user may call abort in handler
        process.nextTick(() => this.emit('hashMagicBuilderStarted'))
      }
    }
  }

  abort() {

    this.pending = []
    this.running.forEach(job => job.abort())
    this.aborted = true
  }
}

export const createHashMagicBuilder = (filer, limit) => new HashMagicBuilder(filer, limit)

