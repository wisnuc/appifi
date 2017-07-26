const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const crypto = require('crypto')
const stream = require('stream')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const formidable = require('formidable')
const sanitize = require('sanitize-filename')
const UUID = require('uuid')
const ioctl = require('ioctl')

const debug = require('debug')('writedir')

const createAppendStream = require('../../lib/fs-append-stream')
const { readXstatAsync, forceXstatAsync } = require('../lib/xstat')
const broadcast = require('../../common/broadcast')

const ErrorAbort = new Error('aborted')
const EMPTY_SHA256_HEX = crypto.createHash('sha256').digest('hex')

const K = x => y => x

let fruitmixPath

broadcast.on('FruitmixStart', froot => (fruitmixPath = froot))
broadcast.on('FruitmixStop', () => (fruitmixPath = undefined))

const combineHash = (a, b) => {
  let a1 = typeof a === 'string'
    ? Buffer.from(a, 'hex')
    : a

  console.log('a1 length', a1.length)

  let b1 = typeof b === 'string'
    ? Buffer.from(b, 'hex')
    : b

  console.log('b1 length', b1.length)

  let hash = crypto.createHash('sha256')
//  hash.update(a1)
//  hash.update(b1)
  hash.update(Buffer.concat([a1, b1]))

  let digest = hash.digest('hex')
  console.log('combined digest', digest)
  return digest
}

const threadify = base => class extends base {
  constructor (...args) {
    super(...args)
    this._thrListeners = []
  }

  /**
  value is optional
  set is optional
  **/
  observe (name, value, set) {
    let _name = '_' + name
    this[_name] = value
    Object.defineProperty(this, name, {
      get: function () {
        return this[_name]
      },
      set: set || function (x) {
        if (this[_name]) return
        debug('observe set', name,
          x instanceof stream
            ? 'stream'
            : Array.isArray(x)
              ? 'array length ' + x.length
              : x)
        this[_name] = x
        process.nextTick(() => this.updateListeners())
      }
    })
  }

  async until (predicate) {
    if (predicate()) return
    return new Promise((resolve, reject) =>
      this._thrListeners.push({ predicate, resolve, reject }))
  }

  async untilAnyway (predicate) {
    if (predicate()) return
    return new Promise((resolve, reject) =>
      this._thrListeners.push({ predicate, resolve }))
  }

  updateListeners () {
    this._thrListeners = this._thrListeners
      .reduce((arr, x) => (this.error && x.reject)
        ? K(arr)(x.reject(this.error))
        : x.predicate()
          ? K(arr)(x.resolve())
          : [...arr, x], [])
  }

  // don't know
  async throwable (promise) {
    let x = await promise
    if (this.error) throw this.error
    return x
  }

  guard (f) {
    return (...args) => {
      if (this.error) return
      try {
        f(...args)
      } catch (e) {
        this.error = e
      }
    }
  }
}

class PartHandler extends threadify(EventEmitter) {
  constructor (part, ready) {
    super()

    this.part = part
    this.observe('ready', ready)
    this.observe('error', null, function (x) {
      if (this._error) return
      debug('set error', x)
      this._error = x
      this.emit('error', x)
      process.nextTick(() => this.updateListeners())
    })

    this.run()
  }

  run (...args) {
    this.runAsync(...args)
      .then(() => {})
      .catch(e => {
        if (this.error !== e) debug('final error', e)
        this.error = e
      })
      .then(() => {
        debug(`${this.constructor.name} finally`)
        this.emit('finish')
      })
  }

  // when success
  async streamPart (tmpPath) {
    try {
      this.as = createAppendStream(tmpPath)
      this.as.on('error', this.guard(err => (this.error = err)))
      this.as.on('finish', this.guard(() => (this.asFinished = true)))
      this.buffers.forEach(buf => this.as.write(buf))
      this.buffers = null
      this.part.form.resume()
      await this.until(() => this.partEnded)
    } catch (e) {
      this.error = e
      throw e
    } finally {
      this.as.end()
      await this.until(() => this.asFinished)
    }
  }

  definePartStream () {
    this.observe('as')
    this.observe('asFinished')
    this.observe('partEnded')
    this.buffers = []
    this.bytesWritten = 0
    this.part.on('data', this.guard(chunk => {
      this.part.form.pause()
      if (this.as) {
        this.as.write(chunk, this.guard(err => {
          if (err) {
            this.error = err
          } else {
            this.bytesWritten += chunk.length
            this.part.form.resume()
          }
        }))
      } else {
        this.buffers.push(chunk)
      }
    }))
    this.part.on('error', this.guard(err => (this.error = err)))
    this.part.on('end', this.guard(() => (this.partEnded = true)))
  }
}

class FieldHandler extends PartHandler {
  async runAsync () {
    this.observe('parsed', false)

    let buffers = []

    this.part.on('data', this.guard(chunk => buffers.push(chunk)))
    this.part.on('end', this.guard(() => {
      let { op, overwrite } = JSON.parse(Buffer.concat(buffers))
      if (op === 'mkdir') {
        this.part.opts = { op }
      } else if (op === 'rename' || op === 'dup') {
        this.part.opts = { op, overwrite }
      } else if (op === 'remove') {
        this.part.opts = { op }
      } else {
        this.error = new Error('Unrecognized op code')
        return
      }

      this.parsed = true
    }))

    await this.until(() => this.parsed && this.ready)

    let fromPath = path.join(this.part.dir.abspath(), this.part.fromName)
    let toPath = path.join(this.part.dir.abspath(), this.part.toName)

    if (this.part.opts.op === 'mkdir') {
      await this.throwable(mkdirpAsync(toPath))
    } else if (this.part.opts.op === 'rename') {
      // TODO support overwrite ???
      await this.throwable(fs.renameAsync(fromPath, toPath))
    } else if (this.part.opts.op === 'dup') {
      // TODO support overwrite ???
      await this.throwable(fs.renameAsync(fromPath, toPath))
    } else if (this.part.opts.op === 'remove') {
      await this.throwable(rimrafAsync(fromPath))
    } else {
      throw new Error('Internal Error')
    }
  }
}

class NewEmptyFileHandler extends PartHandler {
  async runAsync () {
    this.observe('partEnded')
    this.part.on('error', this.guard(err => (this.error = err)))
    this.part.on('end', this.guard(() => (this.partEnded = true)))
    let tmpPath = path.join(fruitmixPath, 'tmp', UUID.v4())
    try {
      let fd = await this.throwable(fs.openAsync(tmpPath, 'w'))
      await this.throwable(fs.closeAsync(fd))
      await this.throwable(forceXstatAsync(tmpPath, { hash: EMPTY_SHA256_HEX }))
      await this.until(() => this.ready && this.partEnded)
      let dstPath = path.join(this.part.dir.abspath(), this.part.toName)
      await this.throwable(fs.renameAsync(tmpPath, dstPath))
    } catch (e) {
      this.error = e
      rimraf(tmpPath, () => {})
    }
  }
}

/**
There are two finally logics there:
1. as should be guaranteed to end, this translates into
  + as.end() must be called
  + wait until asFinished anyway
2.
*/
class NewNonEmptyFileHandler extends PartHandler {
  async runAsync () {
    this.definePartStream()

    let tmpPath = path.join(fruitmixPath, 'tmp', UUID.v4())
    let dstPath = path.join(this.part.dir.abspath(), this.part.toName)
    try {
      await this.streamPart(tmpPath)

      if (this.bytesWritten !== this.part.opts.size) throw new Error('size mismatch')
      if (this.bytesWritten !== this.as.bytesWritten) throw new Error('bytesWritten mismatch')
      if (this.as.digest !== this.part.opts.sha256) throw new Error('sha256 mismatch')
      await this.throwable(forceXstatAsync(tmpPath, { hash: this.part.opts.sha256 }))
      await this.until(() => this.ready)
      await this.throwable(fs.renameAsync(tmpPath, dstPath))
    } finally {
      rimraf(tmpPath, () => {})
    }
  }
}

class AppendHandler extends PartHandler {
  async runAsync () {
    this.definePartStream()

    await this.until(() => this.ready)

    let srcPath = path.join(this.part.dir.abspath(), this.part.fromName)
    let dstPath = path.join(this.part.dir.abspath(), this.part.toName)
    let tmpPath = path.join(fruitmixPath, 'tmp', UUID.v4())
    try {
      let xstat = await this.throwable(readXstatAsync(srcPath))
      let [srcFd, tmpFd] = await this.throwable(Promise.all([
        fs.openAsync(srcPath, 'r'),
        fs.openAsync(tmpPath, 'w')
      ]))
      ioctl(tmpFd, 0x40049409, srcFd)
      await this.throwable(Promise.all([fs.closeAsync(tmpFd), fs.closeAsync(srcFd)]))

      // check xstat
      let xstat2 = await this.throwable(readXstatAsync(srcPath))
      if (xstat2.uuid !== xstat.uuid || xstat2.mtime.getTime() !== xstat.mtime.getTime()) throw new Error('race')

      await this.streamPart(tmpPath)

      await this.throwable(forceXstatAsync(tmpPath, {
        uuid: xstat.uuid,
        hash: combineHash(this.part.opts.append, this.as.digest)
      }))

      await this.throwable(fs.renameAsync(tmpPath, dstPath))
    } finally {
      rimraf(tmpPath, () => {})
    }
  }
}

class Writedir extends threadify(EventEmitter) {
  constructor (dir, req) {
    super()

    // children
    this.observe('children', [], function (x) {
      this._children = x
      process.nextTick(() => this.updateListeners())
    })

    //
    this.observe('error', null, function (x) {
      if (this._error) return
      this._error = x
      this.children.forEach(child => (child.error = ErrorAbort))
      process.nextTick(() => this.updateListeners())
    })

    this.run(dir, req)
      .then(() => {})
      .catch(e => {
        if (this.error !== e) debug('final error', e)
        this.error = e
      })
      .then(() => {
        debug(`${this.constructor.name} run success`)
        this.emit('finish')
      })
  }

  // this function works in finally logic
  async run (dir, req) {

    this.observe('formEnded', false)
    let number = 0
    let form = new formidable.IncomingForm()

    form.onPart = this.guard(part => {
      try {
        this.parse(part)
      } catch (e) {
        this.error = e
        return
      }

      // decorate part
      part.number = number++
      part.form = form
      part.dir = dir

      // create handler
      let ready = !this.children.find(h => h.part.toName === part.fromName)
      let child = !part.filename
        ? new FieldHandler(part, ready)
        : part.opts.append
          ? new AppendHandler(part, ready)
          : part.opts.size === 0
            ? new NewEmptyFileHandler(part, ready)
            : new NewNonEmptyFileHandler(part, ready)

      // hook event handler
      child.on('error', err => (this.error = err))
      child.on('finish', () => {
        let index = this.children.indexOf(child)
        this.children = [...this.children.slice(0, index), ...this.children.slice(index + 1)]
        let next = this.children.find(c => c.part.fromName === part.toName)
        if (next) next.ready = true
      })

      // push into children
      this.children = [...this.children, child]
    })

    // on error, request is paused automatically so it blocks further error and end
    form.on('error', this.guard(err => (this.error = err)))
    form.on('aborted', this.guard(() => (this.error = new Error('form aborted'))))
    form.on('end', this.guard(() => (this.formEnded = true)))
    form.parse(req)

    await this.untilAnyway(() => this.children.length === 0 && (this.error || this.formEnded))
  }

  /**

  @throws
  */
  parse (part) {
    // validate name and generate part.fromName and .toName
    let split = part.name.split('|')
    if (split.length === 0 || split.length > 2) throw new Error('invalid name')
    if (!split.every(name => name === sanitize(name))) throw new Error('invalid name')
    part.fromName = split.shift()
    part.toName = split.shift() || part.fromName

    if (part.filename) {
      // validate part.filename and generate part.opts
      let { size, sha256, append } = JSON.parse(part.filename)
      if (!Number.isInteger(size)) throw new Error('size must be a integer')
      if (size < 0 || size > 1024 * 1024 * 1024) throw new Error('size out of range')
      // TODO

      part.opts = { size, sha256, append }
    }
  }

  abort () {
  }
}

module.exports = Writedir
