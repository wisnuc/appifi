

const path = require('path')
const fs = require('fs')
const child = require('child_process') 
const crypto = require('crypto')
const EventEmitter = require('events')
const UUID = require('node-uuid')

import config from '../cluster/config'
import E from '../lib/error' 
import { DIR } from '../lib/const' 

const ERROR = (code, _text) => (text => 
  Object.assign(new Error(text || _text), { code }))

const EFAIL = ERROR('EFAIL', 'operation failed') 
const EINVAL = ERROR('EINVAL', 'invalid argument')
const EINTR = ERROR('EINTR', 'operation interrupted')
const ENOENT = ERROR('ENOENT', 'entry not found')

// a simple version to avoid canonical json, for easy debug
const stringify = (object) => 
  JSON.stringify(Object.keys(object)
    .sort().reduce((obj, key) => {
      obj[key] = object[key]
      return obj
    }, {}))

// hash stringified option object
const optionHash = (opts) => 
  crypto.createHash('sha256')
    .update(stringify(opts))
    .digest('hex')

// generate geometry string for convert
const geometry = (width, height, modifier) => {

  let str
  if (!height)
    str = `${width.toString()}`
  else if (!width)
    str = `x${height.toString()}`
  else {
    str = `${width.toString()}x${height.toString()}`

    if (modifier === 'caret') {
      str += '^'
    }
    // switch (modifier) {
    //   case 'caret':
    //     str += '^'
    //     break
    //   default:
    // }
  } 
  return str
}

// parse query to opts
const parseQuery = (query) => {

  let { width, height, modifier, autoOrient } = query

  if (width !== undefined) {
    width = parseInt(width) 
    if (!Number.isInteger(width) || width === 0 || width > 4096)
      return EINVAL('invalid width') 
  }

  if (height !== undefined) {
    height = parseInt(height)
    if (!Number.isInteger(height) || height === 0 || height > 4096)
      return EINVAL('invalid height')
  }

  if (!width && !height) return EINVAL('no geometry')

  if (!width || !height) modifier = undefined
  if (modifier && modifier !== 'caret') return EINVAL('unknown modifier')

  if (autoOrient !== undefined) {
    if (autoOrient !== 'true') 
      return EINVAL('invalid autoOrient') 
    autoOrient = true
  }

  return { width, height, modifier, autoOrient }
}

// convert, return abort function
const convert = (key, src, opts, callback) => {

  let dst = path.join(config.path, DIR.THUMB, key)
  let tmp = path.join(config.path, DIR.TMP, UUID.v4())
  let args = []
  args.push(src)
  if (opts.autoOrient) args.push('-auto-orient')
  args.push('-thumbnail')
  args.push(geometry(opts.width, opts.height, opts.modifier))
  args.push(tmp)

  child.spawn('convert', args)
    .on('error', err => {
      callback(err)
    })
    .on('close', code => {
      if (code !== 0) {
        callback(EFAIL('convert spawn failed with exit code ${code}'))
      }
      else {
        return fs.rename(tmp, dst, callback)
      }
    })

  // function CALLBACK(err) {
  //   if (finished) return
  //   if (spawn) spawn = spawn.kill()
  //   finished = true
  //   callback(err)
  // }

  // return () => CALLBACK(EINTR())
}

const generate = (key, src, opts, callback) => {

  let thumbpath = path.join(config.path, DIR.THUMB, key)
  // find the thumbnail file first
  fs.stat(thumbpath, (err, stat) => {

    // if existing, return path for instant, or status ready for pending
    if (!err) return callback(null, thumbpath)

    // if error other than ENOENT, return err
    if (err.code !== 'ENOENT') return callback(err)

    return convert(key, src, opts, callback)
  })
}

class Worker extends EventEmitter {

  constructor(hash, src, opts) {
    super()
    this.finished = false
    this.state = 'pending'
    this.id = hash
    this.src = src
    this.opts = opts
    this.cbMap = new Map()
  }
  
  setCallback(requestId, cb) {
    this.cbMap.set(requestId, cb)
  }
  start() {
    if (this.finished) throw new Error('worker is already finished')
    this.run()
  }

  run() {
    if (this.state != 'pending') return
    this.state = 'running'

    generate(this.id, this.src, this.opts, (err, data) => {
      if(err) {
        return this.error(err)
      }
      this.finish(this, data)
    })
  }

  abort() {
    if (this.finished) throw new Error('worker is already finished')
    this.emit('error', new E.EABORT())
    this.exit()
  }

  finish(data, ...args) {
    this.emit('finish', data, ...args)
    this.reset()
  }

  error(err) {
    this.emit('error', err)
    this.exit()
  }

  isRunning() {
    return this.state === 'running'
  }

  exit() {
    this.finished = true
  }

  reset() {
    this.finished = false
    this.state === 'pending'
  }
}

class Thumb {

  constructor(limit) {
    this.workingQ = []
    this.limit = limit || 40
  }

  schedule() {

    let diff = this.limit - this.workingQ.filter(worker => {
      worker.isRunning()
    }).length
    if (diff <= 0) return

    this.workingQ.filter(worker => !worker.isRunning())
      .slice(0, diff)
      .forEach(worker => worker.start())
  }

  /**
    src: src
    digest: 'string'
    userUUID： 'string'
    query: 'object' 
   */
  request({requestId, src, digest, query}, callback) {
    
    if (this.workingQ.length > 1040) {
      throw new Error('请求过于频繁')
    } 
    let worker = this.createrWorker(requestId, src, digest, query, callback) 
    worker.on('finish', (worker, data) => {
      // callback map
      for (let cb of worker.cbMap.values()) {
        process.nextTick(() => cb(null, data))
        this.workingQ.splice(this.workingQ.indexOf(worker), 1)
      }
      this.schedule()
    })
    worker.on('error', worker => {
      this.workingQ.splice(this.workingQ.indexOf(worker), 1)
      this.workingQ.push(worker)
      this.schedule()
    })
    this.schedule()
  }

  
  // factory function
  createrWorker(requestId, src, digest, query, callback) {

    let opts = parseQuery(query)
    if (opts instanceof Error)  return opts
    
    let hash = digest + optionHash(opts)
    let worker = this.workingQ.find(worker => worker.id === hash)
    if (!worker) {
      worker = new Worker(hash, src, opts)
      // worker.nonblock == true ?
      // this.pendingQ.unshift(worker) : this.pendingQ.push(worker)
      this.workingQ.push(worker)
    }
    worker.setCallback(requestId, callback)
    return worker
  }

  abort(requestId) {
    return this.cbMap.delelte(requestId)
  }

  // register(ipc) {
  //   ipc.register('request', this.request.bind(this))
  //   ipc.register('abort', this.abort.bind(this))
  // }
}

export default Thumb
