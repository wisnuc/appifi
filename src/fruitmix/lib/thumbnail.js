import path from 'path'
import fs from 'fs'

import child from 'child_process'
import crypto from 'crypto'

import UUID from 'node-uuid'
import models from '../models/models'
import paths from './paths'

// a simple version to avoid canonical json, for easy debug
const stringify = (object) => 
  JSON.stringify(Object.keys(object)
    .sort()
    .reduce((obj, key) => {
      obj[key] = object[key]
      return obj
    }, {}))

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
    default:
    }
  } 

  return str
}

// hash object
const optionHash = (opts) => 
  crypto.createHash('sha256')
    .update(stringify(opts))
    .digest('hex')

// convert, return abort function
const convert = (src, tmp, dst, opts, callback) => {

  let finished = false

  let args = []
  args.push(src)
  if (opts.autoOrient) args.push('-auto-orient')
  args.push('-thumbnail')
  args.push(geometry(opts.width, opts.height, opts.modifier))
  args.push(tmp) 

  let spawn = child
    .spawn('convert', args)
    .on('error', err => CALLBACK(err))
    .on('close', code => {
      spawn = null 
      if (finished) return
      if (code !== 0) 
        CALLBACK(Object.assign(new Error('convert spawn failed with exit code ${code}'), { code: 'EFAIL' }))
      else
        fs.rename(tmp, dst, CALLBACK)
    })

  function CALLBACK(err) {
    if (finished) return
    if (spawn) spawn.kill()
    spawn = null
    finished = true
    callback(err)
  }

  return () => CALLBACK(Object.assign(new Error('aborted'), { code: 'EINTR' }))
}

// parse query to opts
const parseQuery = (query) => {

  const EINVAL = (text) => 
    Object.assign(new Error(text || 'invalid argument'), { code: 'EINVAL' })

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

  return {
    width,
    height,
    modifier,
    autoOrient
  }
}

const createThumbnailer = () => {

  let limit = 1
  let jobs = []

  class Job {

    constructor(key, digest, opts) {
      this.key = key
      this.digest = digest
      this.opts = opts
      this.listeners = []
    }

    addListener(listener) {
      this.listeners.push(listener)
    }

    isRunning() {
      return !!this.abort
    }

    run() {

      const src = models.getModel('forest').readMediaPath(this.digest)
      if (!src) 
        return process.nextTick(finish, Object.assign(new Error('src not found'), {
          code: 'ENOENT'
        }))

      const tmp = path.join(paths.get('tmp'), UUID.v4())
      const dst = path.join(paths.get('thumbnail'), this.key)

      const finish = (err) => {
        this.listeners.forEach(cb => {
          err ? cb(err) : cb(null, dst)
        })
        this.abort = null 
        jobs.splice(jobs.indexOf(this), 1)
        schedule()
      }

      // install new methods
      this.abort = convert(src, tmp, dst, this.opts, finish)
    }
  }

  function schedule() {
  
    let diff = limit - jobs.filter(job => job.isRunning()).length
    if (diff <= 0) return

    jobs.filter(job => !job.isRunning())
      .slice(0, diff)
      .forEach(job => job.run())
  }

  function generate(key, digest, opts) {

    let job = jobs.find(j => j.key === key)
    if (job) return job

    job = new Job(key, digest, opts)
    jobs.push(job)
    if (jobs.filter(job => job.isRunning()).length < limit)
      job.run()

    return job
  }

  function abort() {

    jobs.filter(job => job.isRunning())
      .forEach(job => job.abort())
    jobs = []
  }

  function request (digest, query, callback) {

    let opts = parseQuery(query)
    if (opts instanceof Error)
      return process.nextTick(callback, opts)

    let key = digest + optionHash(opts)
    let thumbpath = path.join(paths.get('thumbnail'), key) 

    // find the thumbnail file first
    fs.stat(thumbpath, (err, stat) => {

      // if existing, return path for instant, or status ready for pending
      if (!err) return callback(null, thumbpath)

      // if error other than ENOENT, return err
      if (err.code !== 'ENOENT') return callback(err)

      // request a job to generate thumbnail 
      let job = generate(key, digest, opts)

      if (query.nonblock === 'true') {
        if (job.isRunning()) {
          callback({ status: 'running' }) 
        }
        else {
          callback({ status: 'pending' })
        }
      }
      else {
        if (job.isRunning()) {
          job.addListener(callback)
        }
        else {
          callback({ status: 'pending' })
        }
      }
    })
  }

  return { request, abort }
}

export default createThumbnailer



