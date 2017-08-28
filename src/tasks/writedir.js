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

const threadify = require('../lib/threadify')
const { isSHA256, isUUID } = require('../lib/assertion')
const createAppendStream = require('../lib/fs-append-stream')
const { readXstatAsync, forceXstatAsync } = require('../lib/xstat')

// clone a file from src to dst
// !!! this function has REVERSED arg order
const btrfsCloneAsync = async (src, dst) => {

  let srcFd = await fs.openAsync(src, 'r')
  try {
    let dstFd = await fs.openAsync(dst, 'w')
    try {
      ioctl(dstFd, 0x40049409, srcFd)      
    } finally {
      await fs.closeAsync(dstFd)
    }
  } finally {
    await fs.closeAsync(srcFd)
  }
}

const EFruitmixUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const _getFruit = require('../fruitmix')
const getFruit = target => {
  let fruit = _getFruit()
  if (!fruit) throw EFruitmixUnavail
  return fruit
}

const EMPTY_SHA256_HEX = crypto.createHash('sha256').digest('hex')

const combineHash = (a, b) => {
  let a1 = typeof a === 'string'
    ? Buffer.from(a, 'hex')
    : a


  let b1 = typeof b === 'string'
    ? Buffer.from(b, 'hex')
    : b

  let hash = crypto.createHash('sha256')
  hash.update(Buffer.concat([a1, b1]))

  let digest = hash.digest('hex')
  return digest
}

class PartHandler extends threadify(EventEmitter) {

  constructor (part, ready) {
    super()
    this.part = part

    this.defineSetOnce('ready')
    if (ready) this.ready = ready

    this.defineSetOnce('error', () => {
      this.error.where = {
        handler: this.constructor.name,
        number: part.number,
        name: part.name,
        filename: part.filename,
        value: part.value
      }
      this.emit('error', this.error)
    })

    this.run(this.part.target)
      .then(() => {})
      .catch(e => {
        if (this.error !== e) debug(`${this.constructor.name} final error`, e.message)
        this.error = e
      })
      .then(() => {
        debug(`${this.constructor.name} finally ${this.error ? 'error' : 'success'}`)
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
    this.defineSetOnce('as')
    this.defineSetOnce('asFinished')
    this.defineSetOnce('partEnded')
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

  async run ({ user, driveUUID, dirUUID}) {
    this.defineSetOnce('parsed')

    let buffers = []

    this.part.on('data', this.guard(chunk => buffers.push(chunk)))
    this.part.on('end', this.guard(() => {
      this.part.value = Buffer.concat(buffers).toString()
      let { op, overwrite } = JSON.parse(this.part.value)

      if (overwrite !== undefined) {
        if (!isUUID(overwrite)) {
          let err = new Error('overwrite is not a valid uuid')
          err.status = 400
          throw err
        }
      }

      if (op === 'mkdir') {
        this.part.opts = { op }
      } else if (op === 'dup') {
        if (this.part.fromName === this.part.toName) {
          let err = new Error('dup requries two different file name')
          err.status = 400
          throw err
        }
        this.part.opts = { op, overwrite }
      } else if (op === 'rename') {
        if (this.part.fromName === this.part.toName) {
          let err = new Error('dup requries two different file name')
          err.status = 400
          throw err
        }
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

    let dirPath = getFruit().getDriveDirPath(user, driveUUID, dirUUID)
    let fromPath = path.join(dirPath, this.part.fromName)
    let toPath = path.join(dirPath, this.part.toName)
    let tmpPath = path.join(getFruit().getTmpDir(), UUID.v4())

    if (this.part.opts.op === 'mkdir') {

      try {
        await mkdirpAsync(toPath)   
      } catch (e) {
        if (e.code === 'EEXIST') {
          e.status = 403
        }
        throw e
      }
      if (this.error) throw this.error

    } else if (this.part.opts.op === 'rename') {

      if (this.part.opts.overwrite) {

        let srcXstat, dstXstat
        try {
          srcXstat = await readXstatAsync(fromPath) 
          if (srcXstat.type === 'directory') {
            let err = new Error(`${this.part.fromName} is a directory`)
            err.code = 'EISDIR'
            err.status = 403
            throw err
          }
        } catch (e) {
          if (e.code === 'ENOENT') {
            let err = new Error(`${this.part.fromName} does not exist`)
            err.code = 'ENOENT'
            err.status = 403
            throw err
          } else {
            throw e
          }
        }

        try {
          dstXstat = await readXstatAsync(toPath) 
          if (dstXstat.type === 'directory') {
            let err = new Error(`${this.part.toName} is a directory`)
            err.code = 'EISDIR'
            err.status = 403
            throw err
          }

          if (dstXstat.uuid !== this.part.opts.overwrite) {
            let err = new Error(`${this.part.toName} uuid mismatch`)
            err.code = 'EMISMATCH'
            err.status = 403
            throw err
          }
        } catch (e) {
          if (e.code === 'ENOENT') {
            let err = new Error(`${this.part.toName} does not exist`)
            err.code = 'ENOENT'
            err.status = 403
            throw err
          } else {
            throw e
          }
        }

        // this is tricky !!!
        try {
          // clone src to tmp
          await btrfsCloneAsync(fromPath, tmpPath)
          let srcXstat2 = await readXstatAsync(fromPath)
          if (srcXstat2.mtime !== srcXstat.mtime) {
            let err = new Error(`race`)
            err.code = 'ERACE'
            err.status = 403
            throw err
          }

          // stamp xstat
          await forceXstatAsync(tmpPath, { 
            uuid: dstXstat.uuid, 
            hash: srcXstat.hash
          })

          // overwrite
          await fs.renameAsync(tmpPath, toPath)
          // remove src
          await rimrafAsync(fromPath)
        } finally {
          try {
            await rimrafAsync(tmpPath)
          } catch (e) {}
        }
        
      } else {

        let srcStat, dstStat
        try {
          srcStat = await fs.lstatAsync(fromPath)
          // TODO
        } catch (e) {
          if (e.code === 'ENOENT') e.status = 403
          throw e
        }

        // this is best effort, not safe
        try {
          let dstStat = await fs.lstatAsync(toPath)
          let err = new Error('target exists')
          err.code = 'EEXIST'
          err.status = 403
          throw err
        } catch (e) {
          if (e.code !== 'ENOENT') throw e
        }

        try {
          await fs.renameAsync(fromPath, toPath)
        } catch (e) {
          // when from does not exist
          if (e.code === 'ENOENT') e.status = 403
          // when from is file, to is dir
          if (e.code === 'EISDIR') e.status = 403
          // when from is dir, to is file
          if (e.code === 'ENOTDIR') e.status = 403
          // when from is dir, to is non-empty dir
          if (e.code === 'ENOTEMPTY') e.status = 403
          throw e
        }
      }
    } else if (this.part.opts.op === 'dup') {

      let xstat1, xstat2
      try {
        xstat1 = await readXstatAsync(fromPath)
        await btrfsCloneAsync(fromPath, tmpPath)
        xstat2 = await readXstatAsync(fromPath)

        if (xstat1.mtime !== xstat2.mtime) {
          try { await rimrafAsync(tmpPath) } catch (e) {}

          let err = new Error('race detected in operation') // TODO remove tmp file
          err.code = 'ERACE'
          throw err
        }
      
      } catch (e) {
        // btrfs clone throw this error
        if (e.code === 'EISDIR') e.status = 403
        if (e.code === 'ENOENT') e.status = 403
        throw e
      }

      if (this.part.opts.overwrite) {

        let xstat
        try {
          xstat = await readXstatAsync(toPath)
        } catch (e) {
          if (e.code === 'ENOENT') e.status = 403
          throw e
        }

        if (xstat.type !== 'file') {
          let err = new Error('target is not a regular file')
          err.code = 'ENOTFILE'
          err.status = 403
          throw err
        }

        if (xstat.uuid !== this.part.opts.overwrite) {
          let err = new Error('overwrite uuid does not match')
          err.status = 403
          throw err
        }
       
        let opts = xstat1.hash
          ? { uuid: xstat.uuid, hash: xstat1.hash } 
          : { uuid: xstat.uuid }

        try {
          await forceXstatAsync(tmpPath, opts)
          await fs.renameAsync(tmpPath, toPath)
        } catch (e) {
          if (e.code === 'EISDIR') e.status = 403
          throw e
        } finally {
          try { await rimrafAsync(tmpPath) } catch (e) {}
        }
      } else {
        if (xstat1.hash) {
          await forceXstatAsync(tmpPath, { hash: xstat1.hash })
        } else {
          await readXstatAsync(tmpPath)
        }

        try {
          await fs.linkAsync(tmpPath, toPath)
        } catch (e) {
          if (e.code === 'EEXIST') e.status = 403 
          throw e
        } finally {
          try { await rimrafAsync(tmpPath) } catch (e) {}
        }
      }

      // await this.throwable(fs.renameAsync(fromPath, toPath))
    } else if (this.part.opts.op === 'remove') {
      await this.throwable(rimrafAsync(fromPath))
    } else {
      throw new Error('Internal Error')
    }
  }

}

class NewEmptyFileHandler extends PartHandler {

  async run ({ user, driveUUID, dirUUID }) {
    this.defineSetOnce('partEnded')
    this.part.on('error', this.guard(err => (this.error = err)))
    this.part.on('end', this.guard(() => (this.partEnded = true)))
    let tmpPath = path.join(getFruit().getTmpDir(), UUID.v4())
    try {
      let fd = await this.throwable(fs.openAsync(tmpPath, 'w'))
      await this.throwable(fs.closeAsync(fd))
      await this.throwable(forceXstatAsync(tmpPath, { hash: EMPTY_SHA256_HEX }))
      await this.until(() => this.ready && this.partEnded)

      let dirPath = getFruit().getDriveDirPath(user, driveUUID, dirUUID) 
      let dstPath = path.join(dirPath, this.part.toName)

      if (this.part.opts.overwrite) {
        let xstat
        try {
          xstat = await this.throwable(readXstatAsync(dstPath))
          if (xstat.uuid !== this.part.opts.overwrite) {
            let err = new Error('overwrite uuid mismatch')
            err.status = 403
            throw err
          }
          await this.throwable(fs.renameAsync(tmpPath, dstPath))
        } catch (e) {
          if (e.code === 'ENOENT') e.status = 403
          throw e
        }
      } else {
        await this.throwable(fs.linkAsync(tmpPath, dstPath))
      }
    } catch (e) {
      if (e.code === 'EEXIST') e.status = 403
      this.error = e
      rimraf(tmpPath, () => {})
    }
  }

}

class NewNonEmptyFileHandler extends PartHandler {

  async run ({ user, driveUUID, dirUUID }) {
    this.definePartStream()

    let tmpPath = path.join(getFruit().getTmpDir(), UUID.v4())
    let dirPath = getFruit().getDriveDirPath(user, driveUUID, dirUUID)
    let dstPath = path.join(dirPath, this.part.toName)

    try {
      // this must be started immediately FIXME so we dont check here as workaround
      await this.streamPart(tmpPath)

      if (this.bytesWritten !== this.part.opts.size) {
        debug(`size mismatch, ${this.bytesWritten}, ${this.part.opts.size}`)
        let err = new Error('size mismatch')
        err.status = 400
        throw err
      }

      if (this.bytesWritten !== this.as.bytesWritten) throw new Error('bytesWritten mismatch')
      if (this.as.digest !== this.part.opts.sha256) {
        let err = new Error('sha256 mismatch')
        err.status = 400
        throw err
      }

      await this.throwable(forceXstatAsync(tmpPath, { hash: this.part.opts.sha256 }))
      await this.until(() => this.ready)

      if (this.part.opts.overwrite) {
        let xstat
        try {
          xstat = await this.throwable(readXstatAsync(dstPath))
          if (xstat.uuid !== this.part.opts.overwrite) {
            let err = new Error('overwrite uuid mismatch')
            err.status = 403
            throw err
          }
          await this.throwable(fs.renameAsync(tmpPath, dstPath))
        } catch (e) {
          if (e.code === 'ENOENT') e.status = 403
          throw e
        }
      } else {
        await this.throwable(fs.linkAsync(tmpPath, dstPath))
      }
    } catch (e) {
      if (e.code === 'EEXIST') e.status = 403
      throw e
    } finally {
      rimraf(tmpPath, () => {})
    }
  }

}

class AppendHandler extends PartHandler {

  async run ({ user, driveUUID, dirUUID }) {
    this.definePartStream()

    await this.until(() => this.ready)

    let fruit = getFruit()
    let dirPath = fruit.getDriveDirPath(user, driveUUID, dirUUID)
    let srcPath = path.join(dirPath, this.part.fromName)
    let dstPath = path.join(dirPath, this.part.toName)
    let tmpPath = path.join(fruit.getTmpDir(), UUID.v4())

    let xstat
    try {
      xstat = await readXstatAsync(srcPath)
    } catch (e) {
      if (e.code === 'ENOENT') {
        let err = new Error('append target does not exist') 
        err.code = e.code
        err.status = 403
        throw err
      } 
      throw e
    }

    if (this.error) throw this.error
    if (xstat.type !== 'file') {
      let err = new Error('append target is not file')
      err.status = 403
      throw err
    }

    let SIZE1G = 1024 * 1024 * 1024 

    if ((xstat.size % SIZE1G) !== 0) {
      let err = new Error('append target size is not multiple giga')
      err.status = 403
      throw err
    }

    if (!xstat.hash) {
      let err = new Error('append target fingerprint not available')
      err.status = 403
      throw err
    }

    if (xstat.hash !== this.part.opts.append) {
      let err = new Error('append target fingerprint does not match')
      err.status = 403
      throw err
    }

    try {
      let [srcFd, tmpFd] = await this.throwable(Promise.all([
        fs.openAsync(srcPath, 'r'),
        fs.openAsync(tmpPath, 'w')
      ]))
      ioctl(tmpFd, 0x40049409, srcFd)
      await this.throwable(Promise.all([fs.closeAsync(tmpFd), fs.closeAsync(srcFd)]))

      // check xstat
      let xstat2 = await this.throwable(readXstatAsync(srcPath))
      if (xstat2.uuid !== xstat.uuid || xstat2.mtime !== xstat.mtime) throw new Error('race')

      await this.streamPart(tmpPath)

      await this.throwable(forceXstatAsync(tmpPath, {
        uuid: xstat.uuid,
        hash: xstat.size === 0 
          ? this.as.digest 
          : combineHash(this.part.opts.append, this.as.digest)
      }))

      await this.throwable(fs.renameAsync(tmpPath, dstPath))
    } catch(e) {
      debug(e)   
      throw e
    } finally {
      rimraf(tmpPath, () => {})
    }
  }

}

class Writedir extends threadify(EventEmitter) {

  constructor (req) {
    super()

    let target = {
      user: req.user,
      driveUUID: req.params.driveUUID,
      dirUUID: req.params.dirUUID
    }

    this.define('children', [])
    this.defineSetOnce('error', () => {
      let e = new Error('aborted')
      this.children.forEach(child => (child.error = e))
    })
    this.defineSetOnce('formEnded')

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
      part.target = target

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
      child.on('error', err => {
        debug(`child ${child.part.number} error event`)
        this.error = err
      })
      child.on('finish', () => {
        debug(`child ${child.part.number} finish event`)
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

    this.untilAnyway(() => this.children.length === 0 && (this.error || this.formEnded))
      .then(() => this.emit('finish'))
  }

  parse (part) {
    // validate name and generate part.fromName and .toName
    let split = part.name.split('|')
    if (split.length === 0 || split.length > 2) throw new Error('invalid name')
    if (!split.every(name => name === sanitize(name))) throw new Error('invalid name')
    part.fromName = split.shift()
    part.toName = split.shift() || part.fromName

    if (part.filename) {
      // validate part.filename and generate part.opts
      let { size, sha256, append, overwrite } = JSON.parse(part.filename)

      if (!Number.isInteger(size)) {
        let err = new Error('size must be a integer')
        err.status = 400
        throw err
      }

      if (size > 1024 * 1024 * 1024 || size < (append ? 1 : 0)) {
        let err = new Error('size out of range')
        err.status = 400
        throw err
      }

      if (!isSHA256(sha256)) {
        if (size === 0) {
          sha256 = EMPTY_SHA256_HEX 
        } else {
          let err = new Error('invalid sha256')
          err.status = 400
          throw err
        }
      }

      if (overwrite !== undefined) {

        console.log('overwrite', overwrite)

        if (!isUUID(overwrite)) {
          let err = new Error('overwrite is not a valid uuid string')
          err.status = 400
          throw err
        }
      }

      if (append !== undefined) {
        if (!isSHA256(append)) {
          let err = new Error('append is not a valid fingerprint string')
          err.status = 400
          throw err
        }
      }

      part.opts = { size, sha256, append, overwrite }
    }
  }

  abort () {
    this.error = new Error('aborted')
  }

}

module.exports = Writedir
