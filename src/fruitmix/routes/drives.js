const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const crypto = require('crypto')
const ioctl = require('ioctl')

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const UUID = require('uuid')
const router = require('express').Router()
const formidable = require('formidable')

const auth = require('../middleware/auth')
const broadcast = require('../../common/broadcast')

const Drive = require('../models/drive')
const Forest = require('../forest/forest')
const { readXstat, readXstatAsync, forceXstat, forceXstatAsync } = require('../lib/xstat')
const formdata = require('./formdata')
const { upload, uploadAsync } = require('../lib/sidekick-client')

const stream = require('stream')

const sanitize = require('sanitize-filename')

const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(mkdirp)

const K = x => y => x
const f = af => (req, res, next) => af(req, res).then(x => x, next)

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
  hash.update(a1)
  hash.update(b1)

  let digest = hash.digest('hex')
  console.log('combined digest', digest)
  return digest
}

router.get('/', auth.jwt(), (req, res) => {
  let drives = Drive.drives.filter(drv => {
    if (drv.type === 'private' && drv.owner === req.user.uuid) { return true }
    if (drv.type === 'public') {
      if (drv.writelist.includes(req.user.uuid) ||
        drv.readlist.includes(req.user.uuid)) { return true }
    }
    return false
  })

  res.status(200).json(drives)
})

router.post('/', auth.jwt(), (req, res) => {
  let props = req.body
  Drive.createPublicDriveAsync(props)
    .then(drive => res.status(200).json(drive))
    .catch(e => res.status(500).json({ code: e.code, message: e.message }))
})

/**
010   get dirs
*/
router.get('/:driveUUID/dirs', auth.jwt(), (req, res) => {
  let { driveUUID } = req.params

  if (!Forest.roots.has(driveUUID)) { return res.status(404).end() }

  res.status(200).json(Forest.getDriveDirs(driveUUID))
})

/**
020 * create a new dir (mkdir)
*/
router.post('/:driveUUID/dirs', auth.jwt(), f(async (req, res) => {
  let { driveUUID } = req.params

  let parent = Forest.getDriveDir(driveUUID, req.body.parent)
  if (!parent) { return res.status(404).end() }

  let dirPath = path.join(parent.abspath(), req.body.name)

  // TODO let xstat = await readXstatAsync(parentPath)

  try {
    await fs.mkdirAsync(dirPath)
  } catch (e) {
    if (e.code === 'ENOENT') {
    } else if (e.code === 'ENOTDIR') {
    } else {
    }
  }

  let xstat = await readXstatAsync(dirPath)
  parent.read()

  res.status(200).json({

    uuid: xstat.uuid,
    parent: parent.uuid,
    name: xstat.name,
    mtime: xstat.mtime
  })
}))

/**
030   get a dir
*/

/**
router.get('/:driveUUID/dirs/:dirUUID', auth.jwt(),
  f(async(req, res) => {
    let { driveUUID, dirUUID } = req.params

    let dir = Forest.getDriveDir(driveUUID, dirUUID)
    if (!dir) return res.status(404).end()

    res.status(200).json({
      uuid: dir.uuid,
      parent: dir.parent ? dir.parent.uuid : '',
      name: dir.name,
      mtime: Math.abs(dir.mtime)
    })
  }))
**/

/**
031 * list a dir
*/
router.get('/:driveUUID/dirs/:dirUUID/list', auth.jwt(),
  f(async(req, res) => {
    let { driveUUID, dirUUID } = req.params
    let dir = Forest.getDriveDir(driveUUID, dirUUID)
    if (!dir) { return res.status(404).end() }

    let xstats = await dir.readdirAsync()
    res.status(200).json(xstats)
  }))

/**
032    listnav a dir
*/
router.get('/:driveUUID/dirs/:dirUUID', auth.jwt(), f(async(req, res) => {
  let { driveUUID, dirUUID } = req.params
  let dir = Forest.getDriveDir(driveUUID, dirUUID)
  if (!dir) { return res.status(404).end() }

  let list = await dir.readdirAsync()
  let nav = dir.nodepath().map(dir => ({
    uuid: dir.uuid,
    name: dir.name,
    mtime: Math.abs(dir.mtime)
  }))

  res.status(200).json({
    path: nav,
    entries: list
  })
}))

router.get('/:driveUUID/dirs/:dirUUID/entries', auth.jwt(), f(async(req, res) => {
  let { driveUUID, dirUUID } = req.params
  let dir = Forest.getDriveDir(driveUUID, dirUUID)
  if (!dir) { return res.status(404).end() }

  let list = await dir.readdirAsync()
  res.status(200).json(list)
}))

const ErrorAbort = new Error('aborted')

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
          console.log('observe set', name, 'array length ' + x.length)
        } else {
          console.log('observe set', name, this[_name], Array.isArray(x) ? 'length ' + x.length : x)
        }
        this[_name] = x
        process.nextTick(() => this._until())
      }
    }, override))
  }

  run(...args) {
    this.runAsync(...args)
      .then(() => this.emit('finish', null))
      .catch(e => this.emit('finish', e))
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
    } else {
      // TODO
    }
  }
}

class NewFileHandler extends Thread {

  async runAsync (part) {
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

class DirOperation extends Thread {

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
}

/**
class DirOperation extends EventEmitter {

  constructor(dir, req) {
    super()

    this.number = 0
    this.form = new formidable.IncomingForm()
    this.dir = dir
 
    let form = this.form
    let error
    let formEnded = false
    let handlers = []
    let finished = false

    const finalize = err => {
      if (finished) return
      if (!this.error && err) {
        this.error = err
        let errAbort = new Error('aborted')
        handlers.forEach(h => h.error = errAbort)
      }

      if (this.error && handlers.length === 0) {
        dir.read()
        finished = true
        console.log('error finished', this.error)
        this.emit('finish', this.error)
      } else if (!error && handlers.length === 0 && formEnded) {
        dir.read()
        finished = true
        console.log('success finished')
        this.emit('finish', null)
      }
    }

    form.onPart = part => {
      if (this.error) return

      try {
        this.parse(part)
      } catch (e) {
        return finalize(e)
      }

      let blocked = !!handlers.find(h => h.part.toName === part.fromName)
      let handler

      if (!part.filename) {
        handler = new FieldHandler(blocked, part)
      } else {
        if (part.opts.append) {
          handler = new AppendHandler(blocked, part)
        } else {
          handler = new NewFileHandler(blocked, part)
        } 
      }

      handler.on('finish', err => {
        if (err) form.pause()

        console.log(`${handler.part.number}: finished ${err && err.message}`)
        console.log(handlers.map(h => ('' + h.part.number + ':' + h.part.name)))

        // remove handler out of queue
        let index = handlers.indexOf(handler)
        handlers.splice(index, 1)

        // run next if any
        let next = handlers.slice(index).find(h => h.part.fromName === part.toName)
        if (next) next.blocked = false

        finalize(err)
      })

      handlers = [...handlers, handler]
    }

    // on error, request is paused automatically so it blocks further error and end
    form.on('error', err => finalize(err))
    form.on('aborted', () => finalize(new Error('aborted')))
    form.on('end', () => (formEnded = true) && finalize())
    form.parse(req)
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

    part.number = this.number++
    part.form = this.form
    part.dir = this.dir
  }
}

**/

router.post('/:driveUUID/dirs/:dirUUID/entries', auth.jwt(), (req, res, next) => {
  if (!req.is('multipart/form-data')) { 
    return res.status(415).json({ message: 'must be multipart/form-data' }) 
  }

  let { driveUUID, dirUUID } = req.params
  let dir = Forest.getDriveDir(driveUUID, dirUUID)
  if (!dir) { return res.status(404).end() }

  let x = new DirOperation(false, dir, req)
  x.on('finish', err => {
    err ? res.status(500).end()
      : res.status(200).end()
  })
})

/**
040 * patch a directory (rename)
*/
router.patch('/:driveUUID/dirs/:dirUUID', auth.jwt(),
  f(async(req, res) => {
    let { driveUUID, dirUUID } = req.params
    let { name } = req.body

    let dir = Forest.getDriveDir(driveUUID, dirUUID)
    if (!dir) { return res.status(404).end() }
    if (Forest.isRoot(dir)) { return res.status(403).end() }

    let oldPath = dir.abspath()
    let newPath = path.join(oldPath.dirname(), name)

  // to avoid rename to existing file
    await fs.closeAsync(await fs.openAsync(newPath, 'wx'))
    await fs.renameAsync(oldPath, newPath)

    dir.parent.read()

    let xstat = await readXstatAsync(newPath)

    res.status(200).json({
      uuid: xstat.uuid,
      parent: dir.parent.uuid,
      name: xstat.name,
      mtime: xstat.mtime
    })
  }))

/**
050 * delete a directory (rmdir)
*/
router.delete('/:driveUUID/dirs/:dirUUID', auth.jwt(),
  f(async (req, res) => {
    let { driveUUID, dirUUID } = req.params

    let dir = Forest.getDriveDir(driveUUID, dirUUID)
    if (!dir) { return res.status(404).end() }
    if (Forest.isRoot(dir)) { return res.status(403).end() }

    await rimrafAsync(dir.abspath())
    res.status(200).end()
  }))

/**
060   get files
*/
router.get('/:driveUUID/dirs/:dirUUID/files', auth.jwt(), (req, res) => {
  let { driveUUID, dirUUID } = req.params
  res.status(200).end()
})

/**
070 * create a new file (upload / new)
*/
router.post('/:driveUUID/dirs/:dirUUID/files', auth.jwt(),
  (req, res, next) => {
    let { driveUUID, dirUUID } = req.params

    req.formdata = {
      path: path.join(fruitmixPath, 'tmp', UUID.v4()) // TODO
    }

    next()
  }, formdata, f(async (req, res) => {
    let { driveUUID, dirUUID } = req.params
    let { path: srcPath, filename, size, sha256 } = req.formdata

    let dir = Forest.getDriveDir(driveUUID, dirUUID)

    /**
    race condition detected if dir.read() and readXstat() called simultaneously on the same virgin file.
    so we equip src (temp) file before renaming
    **/
    // let xstat = await readXstatAsync(srcPath)
    let xstat = await forceXstatAsync(srcPath, { hash: sha256 })

    let name, dstPath
    for (let suffix = 0; ; suffix++) {
      name = suffix === 0
        ? filename
        : `${filename} (${suffix})`

      dstPath = path.join(dir.abspath(), name)

      try {
        await fs.closeAsync(await fs.openAsync(dstPath, 'wx'))
        break
      } catch (e) {
        if (e.code !== 'EEXIST') { throw e }
      }
    }

    await fs.renameAsync(srcPath, dstPath)
    dir.read()

    delete xstat.type
    xstat.name = name

    res.status(200).json(xstat)
  }))

/**
080   get a file
*/
router.get('/:driveUUID/dirs/:dirUUID/files/:fileUUID', auth.jwt(), (req, res) => {
  let { driveUUID, dirUUID, fileUUID } = req.params
  res.status(200).end()
})

/**
090 * patch a file (rename)
*/
router.patch('/:driveUUID/dirs/:dirUUID/files/:fileUUID', auth.jwt(),
  f(async (req, res) => {
    let { driveUUID, dirUUID, fileUUID } = req.params
    let { oldName, newName } = req.body

    console.log('090 patch file name', driveUUID, dirUUID, fileUUID)

    let dir = Forest.getDriveDir(driveUUID, dirUUID)

    let oldPath = path.join(dir.abspath(), oldName)
    let newPath = path.join(dir.abspath(), newName)

    let xstat = await readXstatAsync(oldPath)
    // confirm fileUUID TODO

    await fs.renameAsync(oldPath, newPath)

    dir.read()
    res.status(200).end()
  }))

/**
100 * delete a file
*/
router.delete('/:driveUUID/dirs/:dirUUID/files/:fileUUID', auth.jwt(),
  f(async (req, res) => {
    let { driveUUID, dirUUID, fileUUID } = req.params
    let { name } = req.query

    let dir = Forest.getDriveDir(driveUUID, dirUUID)

    let filePath = path.join(dir.abspath(), name)
    let xstat = await readXstatAsync(filePath)
    // confirm fileUUID TODO

    await rimrafAsync(filePath)

    res.status(200).end()
  }))

/**
110 * get file data (download)
*/
router.get('/:driveUUID/dirs/:dirUUID/files/:fileUUID/data', auth.jwt(),
  f(async (req, res) => {
    let { driveUUID, dirUUID, fileUUID } = req.params
    let { name } = req.query

    let dir = Forest.getDriveDir(driveUUID, dirUUID)

    let filePath = path.join(dir.abspath(), name)
    let xstat = await readXstatAsync(filePath)
    // confirm fileUUID TODO

    res.status(200).sendFile(filePath)
  }))

/**
120 * put file data (upload / overwrite)
*/
router.put('/:driveUUID/dirs/:dirUUID/files/:fileUUID/data', auth.jwt(),
  f(async (req, res) => {
    let { driveUUID, dirUUID, fileUUID } = req.params
    let { name, size, sha256 } = req.query

    let dir = Forest.getDriveDir(driveUUID, dirUUID)
    let tmpPath = path.join(fruitmixPath, 'tmp', UUID.v4())
    let filePath = path.join(dir.abspath(), name)
    let oldXstat = await readXstatAsync(filePath)

    let status = await new Promise((resolve, reject) => {
      let query = {
        path: tmpPath,
        size: parseInt(size),
        sha256
      }

      let ws = upload(query, (err, status) => err ? reject(err) : resolve(status))
      req.pipe(ws)
    })

    if (status === 200) {
      let newXstat = await forceXstatAsync(tmpPath, { uuid: oldXstat.uuid, hash: sha256 })
      await fs.renameAsync(tmpPath, filePath)
      dir.read()
      res.status(200).end()
    } else { res.status(500).end() }
  }))

module.exports = router
