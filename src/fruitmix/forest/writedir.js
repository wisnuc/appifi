const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const crypto = require('crypto')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const formidable = require('formidable')
const sanitize = require('sanitize-filename')
const UUID = require('uuid')
const ioctl = require('ioctl')

const debug = require('debug')('writedir')

const { readXstat, readXstatAsync, forceXstat, forceXstatAsync } = require('../lib/xstat')
const broadcast = require('../../common/broadcast')

const ErrorAbort = new Error('aborted')

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


/**
This class guarantees the error xor finish is emitted exactly once
*/
class Thread extends EventEmitter {
  constructor (blocked, ...args) {
    super()
    this._untils = []
    this.observe('children', [])

    this.observe('error', null, {
      set: function (x) {
        if (this._error) return
        this._error = x
        this.children.forEach(child => child.error = ErrorAbort)
        process.nextTick(() => this._until())
      } 
    })
    this.observe('blocked', blocked)
    this.run(...args)
  }

  addChild(child, onChildFinish) {
    child.on('finish', err => {
      let index = this.children.indexOf(child)
      this.children = [...this.children.slice(0, index), ...this.children.slice(index + 1)]
      if (err) this.error = err
      onChildFinish(err)
    })

    this.children = [...this.children, child]
  }

  _until () {
    this._untils = this.error
      ? this._untils.reduce((arr, x) => K(arr)(x.reject()), [])
      : this._untils.reduce((arr, x) => x.predicate() ? K(arr)(x.resolve()) : [...arr, x], [])
  }

  async race (promise) {
    let finished = false
    const f = async () => {
      let x = await promise
      finished = true
      this._until()
    }

    return (await Promise.race([f, this.until(() => finished)])).shift()
  }

  async settle (promise) {
    let x = await promise 
    if (this.error) throw this.error
    return x
  }

  guard(f) {
    return (...args) => {
      if (this.error) return
      try {
        f(...args)
      } catch(e) {
        this.error = e
      }
    }
  }

  async untilAsync (predicate) {
    if (predicate()) return
    return new Promise((resolve, reject) => this._untils.push({ predicate, resolve, reject }))
  }

  observe (name, value, override) {
    let _name = '_' + name
    this[_name] = value
    Object.defineProperty(this, name, Object.assign({
      get: function () {
        return this[_name]
      },
      set: function (x) {
        if (Array.isArray(x)) {
          debug('observe set', name, 'array length ' + x.length)
        } else {
          debug('observe set', name, this[_name], Array.isArray(x) ? 'length ' + x.length : x)
        }
        this[_name] = x
        process.nextTick(() => this._until())
      }
    }, override))
  }

  run(...args) {
    this.runAsync(...args)
      .then(() => this.emit('finish', null))
      .catch(e => {
        debug('final error', e)
        this.emit('finish', e)
      })
  }
}

class FieldHandler extends Thread {

  async runAsync (part) {

    this.part = part
    this.observe('parsed', false)

    let buffers = []

    part.on('data', this.guard(chunk => buffers.push(chunk)))
    part.on('end', this.guard(() => {
      let { op, overwrite } = JSON.parse(Buffer.concat(buffers)) 
      if (op === 'mkdir') {
        part.opts = { op }
      } else if (op === 'rename' || op === 'dup') {
        part.opts = { op, overwrite }
      } else {
        // TODO
      }

      this.parsed = true
    }))

    await this.untilAsync(() => this.parsed && !this.blocked)
    
    if (part.opts.op === 'mkdir') {
      let dirPath = path.join(part.dir.abspath(), part.toName)
      await this.settle(mkdirpAsync(dirPath)) 
    } else if (part.opts.op === 'rename') {
      let oldPath = path.join(part.dir.abspath(), part.fromName)
      let newPath = path.join(part.dir.abspath(), part.toName)
      await this.settle(fs.renameAsync(oldPath, newPath))
    } else if (part.opts.op === 'dup') {
      let oldPath = path.join(part.dir.abspath(), part.fromName)  
      let newPath = path.join(part.dir.abspath(), part.toName)
      await this.settle(fs.renameAsync(oldPath, newPath))
    } else if (part.opts.op === 'remove') {
      let entryPath = path.join(part.dir.abspath(), part.fromName)
      await this.settle(rimrafAsync(entryPath))
    } else {
      // TODO
    }
  }
}

class NewFileHandler extends Thread {

  async runAsync (part) {

    debug('new file handler starts', fruitmixPath)

    this.part = part
    this.observe('partEnded', false)
    this.observe('wsFinished', false)

    let tmpPath = path.join(fruitmixPath, 'tmp', UUID.v4())
    let size = 0
    let hash = crypto.createHash('sha256')
    let ws = fs.createWriteStream(tmpPath)

    ws.on('error', this.guard(err => this.error = err))
    ws.on('finish', this.guard(() => this.wsFinished = true ))

    part.on('data', this.guard(chunk => {
      size += chunk.length
      hash.update(chunk)
      part.form.pause()
      ws.write(chunk, err => {
        if (this.error) return 
        if (err) { 
          this.error = err 
        } else { 
          part.form.resume() 
        }
      })
    }))
    part.on('error', this.guard(err => this.error = err))
    part.on('end', this.guard(() => this.partEnded = true))

    try {

      debug('new file handler starts')

      await this.untilAsync(() => this.partEnded)

      ws.end()
      await this.untilAsync(() => this.wsFinished)

      if (size !== part.opts.size) throw new Error('size mismatch')
      if (size !== ws.bytesWritten) throw new Error('bytesWritten mismatch')
      if (hash.digest('hex') !== part.opts.sha256) throw new Error('sha256 mismatch')

      await this.settle(forceXstatAsync(tmpPath, { hash: part.opts.sha256 }))
      await this.untilAsync(() => !this.blocked)

      let dstPath = path.join(part.dir.abspath(), part.toName)
      await this.settle(fs.renameAsync(tmpPath, dstPath))

      debug('newfile handler', tmpPath, dstPath)
    } catch (e) {
      await rimrafAsync(tmpPath)
      throw e
    }
  }
}

class AppendHandler extends Thread {

  async runAsync (part) {
    this.part = part
    this.observe('wsFinished', false)

    let partEnded = false
    let buffers = []
    let size = 0
    let hash = crypto.createHash('sha256')
    let ws

    part.on('data', chunk => {
      if (this.error) { return }

      console.log(`${part.number}: part data`, chunk.length)

      size += chunk.length
      hash.update(chunk)

      if (this.ws) {
        part.form.pause()
        ws.write(chunk, () => part.form.resume())
      } else {
        buffers.push(chunk)
        part.form.pause()
      }
    })

    part.on('error', err => this.error || (this.error = err))

    part.on('end', () => {
      if (this.error) { return }
      partEnded = true
      if (ws) { ws.end() }
    })

    await this.untilAsync(() => !this.blocked)

    let srcPath = path.join(part.dir.abspath(), part.fromName)
    let tmpPath = path.join(fruitmixPath, 'tmp', UUID.v4())
    let dstPath = path.join(part.dir.abspath(), part.toName)
    let xstat = await this.settle(readXstatAsync(srcPath))

    let [srcFd, tmpFd] = await this.settle(Promise.all([fs.openAsync(srcPath, 'r'), fs.openAsync(tmpPath, 'w')]))

    ioctl(tmpFd, 0x40049409, srcFd)
    await this.settle(Promise.all([fs.closeAsync(tmpFd), fs.closeAsync(srcFd)]))

    let xstat2 = await this.settle(readXstatAsync(srcPath))

    ws = fs.createWriteStream(tmpPath, { flags: 'a' })
    ws.on('error', err => (this.error = err))
    ws.on('finish', () => (this.wsFinished = true))

    buffers.forEach(buf => ws.write(buf))
    buffers = null

    if (partEnded) { ws.end() }
    part.form.resume()

    await this.untilAsync(() => this.wsFinished)
    if (this.error) { throw this.error }

    await this.settle(forceXstatAsync(tmpPath, {
      uuid: xstat.uuid,
      hash: combineHash(part.opts.append, hash.digest('hex'))
    }))

    await this.settle(fs.renameAsync(tmpPath, dstPath))
  }
}

class Writedir extends Thread {

  async runAsync(dir, req) {

    this.observe('formEnded', false)

    let number = 0
    let form = new formidable.IncomingForm()

    form.onPart = this.guard(part => {

      this.parse(part)

      part.number = number++
      part.form = form
      part.dir = dir

      let blocked = !!this.children.find(h => h.part.toName === part.fromName)
      let child = !part.filename
        ? new FieldHandler(blocked, part)
        : part.opts.append
          ? new AppendHandler(blocked, part) 
          : new NewFileHandler(blocked, part)

      this.addChild(child, err => {
        if (err) {
          form.pause()
        } else {
          let next = this.children.find(c => c.part.fromName === part.toName)
          if (next) next.blocked = false
        }
      })
    })

    // on error, request is paused automatically so it blocks further error and end
    form.on('error', err => this.error = err)
    form.on('aborted', () => this.error = new Error('form aborted'))
    form.on('end', this.guard(() => this.formEnded = true))
    form.parse(req)

    await this.untilAsync(() => this.children.length === 0 && (this.error || this.formEnded))

    dir.read()

    if (this.error) throw this.error
  } 

  parse(part) {
    // validate name and generate part.fromName and .toName
    let split = part.name.split('|')
    if (split.length === 0 || split.length > 2) { throw new Error('invalid name') }
    if (!split.every(name => name === sanitize(name))) { throw new Error('invalid name') }
    part.fromName = split.shift()
    part.toName = split.shift() || part.fromName

    if (part.filename) {
      // validate part.filename and generate part.opts
      let { size, sha256, append } = JSON.parse(part.filename)
      if (!Number.isInteger(size)) { throw new Error('size must be a integer') }
      if (size < 0 || size > 1024 * 1024 * 1024) { throw new Error('size out of range') }
      // TODO

      part.opts = { size, sha256, append }
    }
  }

  abort() {
  }
}

module.exports = Writedir


