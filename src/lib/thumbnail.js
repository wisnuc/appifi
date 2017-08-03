const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const EventEmitter = require('events')
const crypto = require('crypto')


const UUID = require('uuid')
const mkdirp = require('mkdirp')

const debug = require('debug')('thumbnail')

const { isSHA256, isNonNullObject, isNormalizedAbsolutePath } = require('./assertion')

/**
Thumbnail is a independent module for retrieving a thumbnail.

It uses `<fruitmix root>/thumbnail` as the cache directory.
caching file name: digest (now fingerprint) + optionHash 
query string: width, height, modifier, autoOrient

@module thumbnail
*/

const ERROR = (code, _text) => text => Object.assign(new Error(text || _text), { code })

const EFAIL = ERROR('EFAIL', 'operation failed')
const EINVAL = ERROR('EINVAL', 'invalid argument')
const EINTR = ERROR('EINTR', 'operation interrupted')
const ENOENT = ERROR('ENOENT', 'entry not found')

// courtesy https://stackoverflow.com/questions/5467129/sort-javascript-object-by-key for letting me know the comma operator
const sortObject = o => Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {})

// hash stringified option object
const genKey = (fingerprint, opts) => fingerprint + crypto.createHash('sha256').update(JSON.stringify(sortObject(opts))).digest('hex')

// generate geometry string for convert
const geometry = (width, height, modifier) => {
  let str

  if (!height) { str = `${width.toString()}` } else if (!width) { str = `x${height.toString()}` } else {
    str = `${width.toString()}x${height.toString()}`

    switch (modifier) {
      case 'caret':
        str += '^'
        break
      default:
        break
    }
  }
  return str
}

// parse query to opts
const parseQuery = query => {
  let { width, height, modifier, autoOrient } = query

  if (width !== undefined) {
    width = parseInt(width)
    if (!Number.isInteger(width) || width === 0 || width > 4096) return EINVAL('invalid width')
  }

  if (height !== undefined) {
    height = parseInt(height)
    if (!Number.isInteger(height) || height === 0 || height > 4096) return EINVAL('invalid height')
  }

  if (!width && !height) return EINVAL('no geometry')

  if (!width || !height) modifier = undefined
  if (modifier && modifier !== 'caret') return EINVAL('unknown modifier')

  if (autoOrient !== undefined) {
    if (autoOrient !== 'true') return EINVAL('invalid autoOrient') 
    autoOrient = true
  }

  return { width, height, modifier, autoOrient }
}

/**
This class inherits from EventEmitter.

The finish logic is tranditional, with `error XOR data` bound to single `finish` event, which is a implemented as a race internally. 
*/
class Converter extends EventEmitter {

  /**
  @param {string} src - source file path, must be a normalized absolute path
  @param {string} tmp - tmp dir
  */
  constructor(src, tmpDir, dst, opts) {
    super()

    let tmp = path.join(tmpDir, UUID.v4())

    let args = []
    args.push(src)
    if (opts.autoOrient) args.push('-auto-orient')
    args.push('-thumbnail')
    args.push(geometry(opts.width, opts.height, opts.modifier))
    args.push(tmp)
    this.args = args

    this.src = src
    this.tmp = tmp
    this.dst = dst

    this.finished = false
  }

  // 0 - running
  // 1 - not running but with listeners > 1
  // 2 - single listener
  priority() {
    return this.spawn
      ? 0
      : this.listenerCount('finish') > 1
        ? 1
        : 2
  }

  finalize() {
    if (this.finished) return
    if (this.spawn) this.spawn.kill()     
    this.finished = true
    
    if (this.error) {
      this.emit('finish', this.error)
    } else {
      this.emit('finish', null, this.dst)
    }
  }

  run () {

    debug('converter run', this.args)

    if (this.finished || this.spawn) return
    this.spawn = child.spawn('convert', this.args)
    this.spawn.on('error', err => this.finalize(err))
    this.spawn.on('exit', (code, signal) => {
      this.spawn = null
      if (this.finished) return
      if (code || signal) {
        let err = new Error(`error exit code ${code} or ${signal}`) 
        return this.finalize(err)
      }
      fs.rename(this.tmp, this.dst, err => this.finalize(err))
    }) 
  }

  abort() {
    this.finalize(new Error('aborted'))
  }
}

/**
This class 
*/
class Thumbnail {

  // constructor
  constructor(fruitmixPath, concurrency) {

    this.thumbDir = path.join(fruitmixPath, 'thumbnail')
    this.tmpDir = path.join(fruitmixPath, 'tmp')

    // using synchronous method TODO
    mkdirp.sync(this.thumbDir)
    mkdirp.sync(this.tmpDir)

    this.fruitmixPath = fruitmixPath
    this.concurrency = concurrency || 4
    this.converters = []
    this.aborted = false
  }
  
  // return a path (string) or a converter (event emitter)
  async requestAsync (fingerprint, query, files) {

    if (!isSHA256(fingerprint)) throw new Error('invalid fingerprint')
    if (!isNonNullObject(query)) throw new Error('invalid query')
    if (!Array.isArray(files) || files.length === 0) throw new Error('invalid files')
    if (!files.every(f => isNormalizedAbsolutePath(f))) throw new Error('invalid files')

    if (this.aborted) throw Object.assign(new Error('aborted'), { code: 'EABORT' })

    let opts = parseQuery(query)
    let key = genKey(fingerprint, opts)
    debug('request', fingerprint, query, opts, key)

    let dst = path.join(this.thumbDir, key)
    try {
      let stat = await fs.lstatAsync(dst)
      if (this.aborted) throw new Error('aborted')
      return dst
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }

    let converter = new Converter(files[0], this.tmpDir, dst, opts)
    converter.on('finish', () => {
      if (this.aborted) return
      this.converters.splice(this.converters.indexOf(converter), 1)
      this.schedule()
    })

    this.converters.unshift(converter)

    debug(this.converters)

    process.nextTick(() => this.schedule())
    return converter
  } 

  // schedule
  schedule() {
    this.converters
      .sort((a, b) => a.priority() - b.priority())
      .slice(0, this.concurrency)
      .forEach(c => c.run())
  }

  // abort
  abort() {
    this.converters.forEach(c => c.abort())
    this.converters = []
    this.aborted = true
  }
}

module.exports = Thumbnail

