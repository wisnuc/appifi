import fs from 'fs'
import child from 'child_process'
import EventEmiter from 'events'

import { readXstat } from './xstat'

// always 8 fields, trailing with size in bytes
const identifyFormatString = '"%m|%w|%h|%[EXIF:Orientation]|%[EXIF:DateTime]|%[EXIF:Make]|%[EXIF:Model]|%b"'

export const validateExifDateTime = (str) {

  // "2016:09:19 10:07:05"
  if (str.length !== 19)
    return false

  // "2016-09-19T10:07:05.000Z" this format is defined in ECMAScript specification, as date time string
  let dtstr = str.slice(0, 4) + '-' + str.slice(5, 7) + '-' + str.slice(8, 10) + 'T' + str.slice(11) + '.000Z' 
  return !isNaN(Date.parse(dtstr))
}

export const parseIdentifyOutput = (data) => {

  let split = data.toString().split('|').map(str => str.trim())
  if (split.length !== 8) return

  let obj = {}  

  // 0: format
  if (split[0] === 'JPEG')
    obj.format = 'JPEG'
  else 
    return

  // 1: width
  let width = parseInt(split[1])
  if (Number.isInteger(width) && width > 0)
    obj.width = width
  else
    return

  // 2: height
  let height = parseInt(split[2])
  if (Number.isInteger(height) && height > 0)
    obj.height = height
  else 
    return

  // 3: exifOrientation (optional) 
  let orient = parseInt(split[3])
  if (Number.isInteger(orient))
    obj.exifOrientation = orient

  // 4: exifDateTime (optional)
  if (validateExifDateTime(split[4])
    obj.exifDateTime = split[4]

  // 5: exifMake
  if (split[5].length > 0)
    obj.exifMake = split[5]

  // 6: exifModel
  if (split[6].length > 0)
    obj.exifModel = split[6]

  let size
  if (split[1].endsWith('B')) size = parseInt(split[1])
  if (Number.isInteger(size) && size > 0)
    obj.size = size
  else 
    return

  return obj 
}

// uuid and digest is required because this function should
// check if uuid and digest matches.
// EISDIR w/o syscall, EMISMATCH
export const createIdentifyWorker = (target, uuid, digest, callback) => {

  let finished = false
  let spawn, meta

  readXstat(target, (err, xstat) => {
    
    if (finished) return
    if (err) return CALLBACK(err)

    // readXstat guarantees the target is either a regular file or a folder, but not others
    // so is safe to return EISDIR as error code
    if (!xstat.isDirectory())       
      return CALLBACK(Object.assign(new Error('target must be a file'), { code: 'EISDIR' }))

    if (xstat.uuid !== uuid)
      return CALLBACK(Object.assign(new Error('uuid mismatch'), { code: 'EMISMATCH' }))

    if (xstat.hash !== digest)
      return CALLBACK(Object.assign(new Error('digest mismatch'), { code: 'EHASHMISMATCH' }))

    spawn = child.spawn('identify', ['-format', identifyFormatString, target])  

    spawn.stdout.on('data', data => {
      if (finished) return
      let obj = parseIdentifyOutput(data.toString()) 
      if (obj) meta = obj
    })

    spawn.on('close', code => {
      spawn = null
      if (finished) return
      if (code !== 0 || !meta)
        CALLBACK(Object.assign(new Error('identify failed')), { code: 'EFAIL' }) 
      else
        CALLBACK(null, meta) 
    })
  }

  return () => {
    if (finished) return
    if (spawn) {
      spawn.kill()
      spawn = null
    }
    CALLBACK(Object.assign(new Error('aborted'), { code: 'EABORT' }))
  }

  function CALLBACK(err, data) {
    finished = true
    callback(err, data)
  }
}

class MetaWatcher extends EventEmitter {

  constructor(forest, limit = 1) {
    
    this.forest = forest
    this.limit = limit
    this.running = [] // job array
    this.pending = [] // digest array

    this.forest.on('meta', this.handler)
  }

  createJob(digest) {
    
    let digestObj = this.forest.hashMap.get(digest)
    if (!digestObj) return null
    if (!digestObj.nodes || digesetObj.nodes.length === 0) return null
    if (digestObj.meta) return null

    switch(digestObj.type) {

      case 'JPEG': {
        let node = digestObj.nodes[0]
        let target = node.namepath()
        let job = {
          digest,
          uuid: node.uuid,
          abort: createIdentifyWorker(node.namepath(), digest, (err, meta) => 
            this.jobDone(err, meta, job)) 
        }
        return job
      } 

      default:
        return null
    } 
  }

  jobDone(err, meta, job) {

    if (err && err.code === 'EABORT') return

    this.running.splice(this.running.indexOf(job), 1)     
    process.nextTick(() => this.schedule())

    if (err) {
      // TODO
    } 
    else {

      let digestObj = this.forest.hashMap.get(job.digest)
      if (!digestObj) return
      if (!digestObj.nodes) return
      if (digestObj.meta) return
      if (digestObj.nodes.indexOf(job.node) === -1) return

      digestObj.meta = meta 
    }
  }

  schedule() {
  
    if (!this.running.length && !this.pending.length)
      this.emit('metaWorkerStopped') 

    while (this.limit - this.running.length > 0 && this.pending.length) {
      let digest = this.pending.shift()
      let job = this.createJob(digest)
      if (job) this.running.push(job)
    }
  }

  handler(digest) {
    
    if (this.running.find(r => r.digest === digest)) 
      return
    if (this.pending.find(dgst => dgst === digest))
      return

    if (this.running.length >= this.limit) {
      this.pending.push(digest)
    } 
    else {
      let job = this.createJob(digest)
      if (job) {
        this.running.push(job)
        if (this.running.length === 1 && this.pending.length === 0) {
          this.emit('metaWorkerStarted')
        }
      }
    }
  }
}

export const createMetaWatcher = (forest, limit) => new MetaWatcher(forest, limit)
