import fs from 'fs'
import child from 'child_process'
import EventEmitter from 'events'

import { readXstat } from './xstat'

// always 8 fields, trailing with size in bytes
// !!! don't double quote the string
const identifyFormatString = '%m|%w|%h|%[EXIF:Orientation]|%[EXIF:DateTime]|%[EXIF:Make]|%[EXIF:Model]|%b'

export const validateExifDateTime = (str) => {

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
  if (validateExifDateTime(split[4]))
    obj.exifDateTime = split[4]

  // 5: exifMake
  if (split[5].length > 0)
    obj.exifMake = split[5]

  // 6: exifModel
  if (split[6].length > 0)
    obj.exifModel = split[6]

  let size
  if (split[7].endsWith('B')) 
    size = parseInt(split[7])
  if (Number.isInteger(size) && size > 0)
    obj.size = size
  else 
    return

  return obj 
}

// uuid and digest is required because this function should
// check if uuid and digest matches.
// EISDIR w/o errno, EMISMATCH
export const createIdentifyWorker = (target, uuid, digest, callback) => {

  let finished = false
  let spawn, meta

  readXstat(target, (err, xstat) => {
    
    if (finished) return
    if (err) return CALLBACK(err)

    // readXstat guarantees the target is either a regular file or a folder, but not others
    // so is safe to return EISDIR as error code
    if (xstat.isDirectory())       
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
      if (code !== 0 || !meta) {
        console.log(`code ${code}`)
        console.log(meta)
        CALLBACK(Object.assign(new Error('identify failed')), { code: 'EFAIL' }) 
      }
      else
        CALLBACK(null, meta) 
    })
  })

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

export class MetaBuilder extends EventEmitter {

  constructor(filer, limit = 1) {

    super()
    
    this.filer = filer
    this.limit = limit
    this.running = [] // job array
    this.pending = [] // digest array

    this.filer.on('meta', digest => {
      this.handle(digest)
    })

    this.aborted = false
  }

  createJob(digest) {
    
    let digestObj = this.filer.findDigestObject(digest)

    if (!digestObj) return null
    if (!digestObj.nodes || digestObj.nodes.length === 0) return null
    if (digestObj.meta) return null

    let node = digestObj.nodes[0]
    let uuid = node.uuid
    let target = node.namepath()
    let abort

    switch(digestObj.type) {
      case 'JPEG': 
        abort = createIdentifyWorker(target, uuid, digest, (err, meta) => this.jobDone(err, meta, job)) 
        break

      default:
        return null
    } 

    let job = { digest, uuid, abort }
    this.running.push(job)
  }

  jobDone(err, meta, job) {

    if (err) {
      switch (err.code) {
      case 'EABORT':
        break

      default:
        break
      }
    } 
    else {

      let digestObj = this.filer.findDigestObject(job.digest)

      if (!digestObj) return
      if (!digestObj.nodes || digestObj.nodes.length === 0) return
      if (digestObj.meta) return
      if (!digestObj.nodes.find(node => node.uuid === job.uuid)) return

      digestObj.meta = meta 
    }

    this.running.splice(this.running.indexOf(job), 1)     
    if (!this.running.length && !this.pending.length) {
      // process.nextTick(() => this.emit('metaBuilderStopped'))
      this.emit('metaBuilderStopped')
    }

    // it doesn't matter whether schedule is called or not after abort
    // schedule works only when pending queue non-empty, which is not true after abort
    process.nextTick(() => this.schedule())
  }

  schedule() {
    while (this.limit - this.running.length > 0 && this.pending.length) {
      let digest = this.pending.shift()
      this.createJob(digest)
    }
  }

  handle(digest) {

    if (this.aborted) return
    
    if (this.running.find(r => r.digest === digest)) 
      return
    if (this.pending.find(dgst => dgst === digest))
      return

    if (this.running.length >= this.limit)
      this.pending.push(digest)
    else {
      this.createJob(digest)
      if (this.running.length === 1 && this.pending.length === 0) {
        this.emit('metaBuilderStarted')
      }
    }
  }

  abort() {
    this.pending = []
    this.running.forEach(job => job.abort())
    this.aborted = true
  }

}

export const createMetaBuilder = (filer, limit) => new MetaBuilder(filer, limit)


