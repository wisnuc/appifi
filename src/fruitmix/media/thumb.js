

const path = require('path')
const fs = require('fs')
const child = require('child_process') 
const crypto = require('crypto')
const EventEmitter = require('events')
const UUID = require('node-uuid')

const E = require('../lib/error').default
const { DIR } = require('../lib/const' ).default

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

    switch (modifier) {
      case 'caret':
        str += '^'
        break
      default:
    }
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

  let dst = path.join(DIR.THUMB, key)
  let tmp = path.join(DIR.TMP, UUID.v4())

  let finished = false
  let args = []
  args.push(src)
  if (opts.autoOrient) args.push('-auto-orient')
  args.push('-thumbnail')
  args.push(geometry(opts.width, opts.height, opts.modifier))
  args.push(tmp) 

  let spawn = child.spawn('convert', args)
    .on('error', err => CALLBACK(err))
    .on('close', code => {
      spawn = null 
      if (finished) return
      if (code !== 0) 
        CALLBACK(EFAIL('convert spawn failed with exit code ${code}'))
      else
        fs.rename(tmp, dst, CALLBACK)
    })

  function CALLBACK(err) {
    if (finished) return
    if (spawn) spawn = spawn.kill()
    finished = true
    callback(err)
  }

  return () => CALLBACK(EINTR())
}

class Worker extends EventEmitter {

  constructor(hash, src, opts) {
    super()
    this.finished = false
    this.state = 'pending'
    this.id = hash
    this.src = src
    this.digest = opts
    this.callback = null
  }
  
  setCallback(cb) {
    this.callback ? 
      this.callback.push(cb) : this.callback = [cb]
  }
  start() {
    if (this.finished) throw new Error('worker is already finished')
    this.run()
  }

  run() {
    if (this.state != 'pending') return
    this.state = 'running'

    convert(this.id, this.src, this.opts, (err, data) => {
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
    this.exit()
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
}

class Thumb {

  constructor(limit) {
    this.workingQ = []
    this.limit = limit || 40
  }

  schedule() {

    let diff = this.limit - this.workingQ.filter(worker => worker.isRunning()).length
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
  request({src, digest, query}, callback) {
    
    if (this.workingQ.length > 1040) {
      throw new Error('请求过于频繁')
    } 
    console.log(this.workingQ.length)
    let worker = this.createrWorker(src, digest, query, callback) 
    console.log('worker', JSON.stringify(worker))
    worker.on('finish', (worker, data) => {
      worker.state = 'finished'
      console.log('worker', JSON.stringify(worker))
      // callbackArr
      worker.callback.forEach(cb => {
        process.nextTick(() => cb(null, data))
        this.workingQ.splice(this.workingQ.indexOf(worker), 1)
      })
      this.schedule()
    })
    worker.on('error', worker => {
      worker.state = 'warning'
      this.workingQ.splice(this.workingQ.indexOf(worker), 1)
      this.workingQ.push(worker)
      this.schedule()
    })
    this.schedule()
  }

  
  // factory function
  createrWorker(src, digest, query, callback) {

    let opts = parseQuery(query)
    if (opts instanceof Error)  return opts
    
    let hash = digest + digest + optionHash(opts)
    let worker = this.workingQ.find(worker => worker.id === hash)
    if (!worker) {
      worker = new Worker(hash, src, opts)
      // worker.nonblock == true ?
      // this.pendingQ.unshift(worker) : this.pendingQ.push(worker)
      this.workingQ.push(worker)
    }
    worker.setCallback(callback)
    return worker
  }

  abort(digest, query, callback) {

    let opts = parseQuery(query)
    if (opts instanceof Error)
      return process.nextTick(callback, opts)

    let hash = digest + digest + optionHash(opts)
    this.workingQ.forEach(worker => {
      if (worker.id === hash) {
        worker.callback = null
      }
    })
  }

  register(ipc) {
    ipc.register('request', this.request.bind(this))
    ipc.register('abort', this.abort.bind(this))
  }
}


// let tl = new Thumb(40)

// let count = 0
// //test
// setInterval(function () {
 
//   tl.request({
//     src: '1',
//     digest: '2',
//     userUUID: '3',
//     query: '4'
//   }, (err, data) => {
//     if (err) {
//       console.log('err: ', err)
//     }
//     console.log(++count , 'data: ', data)
//   })
// }, 100)



// // tl.request({
// //   age: 2
// // })

module.exports = Thumb