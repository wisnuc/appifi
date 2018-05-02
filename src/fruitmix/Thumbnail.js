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
Thumbnail is an independent module for retrieving a thumbnail.

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

//
// courtesy https://stackoverflow.com/questions/5467129/sort-javascript-object-by-key
// for letting me know the comma operator
const sortObject = o => Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {})

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

// hash stringified option object
const genKey = (fingerprint, opts) => fingerprint +
  crypto.createHash('sha256').update(JSON.stringify(sortObject(opts))).digest('hex')

// generate geometry string for convert
const geometry = (width, height, modifier) => {
  let str

  if (!height) {
    str = `${width.toString()}`
  } else if (!width) {
    str = `x${height.toString()}`
  } else {
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

// generate convert args
const genArgs = (src, tmp, opts) => {
  let args = []
  args.push(src + '[0]')
  if (opts.autoOrient) args.push('-auto-orient')
  args.push('-thumbnail')
  args.push(geometry(opts.width, opts.height, opts.modifier))
  args.push(tmp)
  return args
}

// spawn a command, err race
const spawn = (cmd, args, callback) => {
  let spawn = child.spawn(cmd, args)
  spawn.on('error', err => {
    spawn.removeAllListeners()
    callback(err)
  })

  spawn.on('exit', (code, signal) => {
    spawn.removeAllListeners()
    if (signal) {
      callback(new Error(`exit signal ${signal}`))
    } else if (code) {
      callback(new Error(`exit code ${code}`))
    } else {
      callback()
    }
  })
}

// pipeline pattern, emit step
class Thumbnail extends EventEmitter {
  constructor (thumbDir, tmpDir, concurrency) {
    super()

    this.thumbDir = thumbDir
    this.tmpDir = tmpDir

    // TODO
    mkdirp.sync(thumbDir)
    mkdirp.sync(tmpDir)

    this.pending = []
    this.converting = []
    this.renaming = []

    this.concurrency = concurrency || 4
    this.destroyed = false
  }

  // { fingerprint, query, key, opt, path, file, cbs }
  push (x) {
    this.pending.push(x)
    this.schedule()
  }

  schedule () {
    if (this.destroyed) return

    // sort pending, the more callbacks, the higher priority
    this.pending.sort((a, b) => b.cbs.length - a.cbs.length)

    while (this.converting.length < this.concurrency && this.pending.length) {
      // pending -> converting
      let x = this.pending.shift()
      this.converting.push(x)

      x.tmp = path.join(this.tmpDir, UUID.v4() + '.jpg')

      spawn('convert', genArgs(x.file, x.tmp, x.opts), err => {
        // converting ->
        this.converting.splice(this.converting.indexOf(x), 1)

        if (err) {
          // -> 0
          x.cbs.forEach(cb => cb(err))
          x.cbs = []
        } else {
          // -> renaming
          this.renaming.push(x)

          fs.rename(x.tmp, x.path, err => {
            // renaming -> 0
            this.renaming.splice(this.renaming.indexOf(x), 1)
            x.cbs.forEach(cb => err ? cb(err) : cb(null, x.path))
            x.cbs = []

            // no schedule
            this.emit('step', 'rename', x)
          })
        }

        this.schedule()
        this.emit('step', 'convert', x)
      })
    }
  }

  // this is mainly used for unit testing. It aborts the whole thumbnail object.
  destroy () {
    // TODO
  }

  // this is a sync function
  genProps (fingerprint, query) {
    if (!isSHA256(fingerprint)) throw new Error('invalid fingerprint')
    if (!isNonNullObject(query)) throw new Error('invalid query')
    let opts = parseQuery(query)
    let key = genKey(fingerprint, opts)

    return {
      fingerprint,
      opts,
      key,
      path: path.join(this.thumbDir, key)
    }
  }

  // props is a thumb props
  convert (props, file, callback) {
    // find existing job by key
    let job = [
      ...this.pending,
      ...this.converting,
      ...this.renaming
    ].find(j => j.key === props.key)

    if (job) {
      job.cbs.push(callback)
    } else {
      // create new job
      job = Object.assign({}, props, { file, cbs: [callback] })
      this.push(job)
    }

    return () => {
      let index = job.cbs.indexOf(callback)
      if (index !== -1) job.cbs.splice(index, 1)
    }
  }
}

module.exports = Thumbnail
