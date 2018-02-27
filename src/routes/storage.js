const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const router = require('express').Router()
const sanitize = require('sanitize-filename')
const formidable = require('formidable')
const rimraf = require('rimraf')

const broadcast = require('../common/broadcast')
const { isNormalizedAbsolutePath } = require('../common/assertion')
const { mkfsBtrfsAsync } = require('../storage/storage')

/**
This module is the router for storage api group.

@module StorageRouter
*/

/**
@typedef {Object} NativeFileEntry
@property {string} name
@property {string} type - may be `file`, `directory`, `link`, `socket`, `fifo`, `char`, `block`, or `unknown`
@property {number} size
@property {number} ctime
*/

/**
storage
*/
let storage = null

broadcast.on('StorageUpdate', (err, data) => err || (storage = data))

/**
This middleware checks if storage available
@param {stream} req
@returns 503 if storage is not available
*/
const avail = (req, res, next) => storage ? next() : res.status(503).json({ message: 'storage not available' })

/**
This middleware translates given name to block device
@param {stream} req
@param {string} req.param.name - block name, such as sda1.
@param {Block} req.body.block - `append` block device
@returns 404 if block device is not found
@returns 403 if named block device has no file system, is volume device, or is not mounted
*/
const blockName = (req, res, next) => {
  let block = storage.blocks.find(blk => blk.name === req.params.name)
  if (!block) return res.status(404).end()
  if (!block.isFileSystem || block.isVolumeDevice || !block.isMounted) return res.status(403).end()
  req.body.block = block
  next()
}

/**
This middleware translates volumeUUID to volume 
@param {stream} req
@param {string} req.param.volumeUUID - volume uuid
@param {Volume} req.body.volume - `append` volume
@returns 404 if volume is not found
@returns 403 if volume has missing device or is not mounted
*/
const volumeUUID = (req, res, next) => {
  let volume = storage.volumes.find(vol => vol.uuid === req.params.volumeUUID)
  if (!volume) return res.status(404).end()
  if (volume.isMissing || !volume.isMounted) return res.status(403).end()
  req.body.volume = volume
  next()
}

/**
This middleware translates path (query string) to body properties
@param {stream} req
@param {string} req.query.path - relative path, no leading slash
@param {string} req.body.path - `append` relative path, default to '' if query string undefined
@param {string} req.body.abspath - `append` absolute path
@returns 500
@returns 400 if path is absolute path or abspath is not a normalized absolute path
*/
const checkPath = (req, res, next) => {
  // not xor
  if (!!req.body.block === !!req.body.volume) return next(new Error('invalid req body, block xor volume'))
  let mp = req.body.block ? req.body.block.mountpoint : req.body.volume.mountpoint

  let relpath = req.query.path || ''
  let abspath = path.join(mp, relpath)
  if (!isNormalizedAbsolutePath(abspath)) return res.status(400).json({ message: 'invalid path' })

  req.body.path = relpath
  req.body.abspath = abspath
  next()
}

/**
This router function lists a directory or download a file, depending file type of given path.
@param {stream} req
@param {string} req.body.abspath
@returns 403 if path is neither regular file nor directory
@returns {module:StorageRouter~NativeFileEntry[]} a list of file entries
*/
const listOrDownload = (req, res, next) => fs.lstat(req.body.abspath, (err, stat) => {
  if (err) return next(err)
  if (!stat.isFile() && !stat.isDirectory()) return res.status(403).json({ message: 'must be a regular file or directory' })
  if (stat.isDirectory()) {
    fs.readdir(req.body.abspath, (err, entries) => {
      if (err) return next(err)
      if (entries.length === 0) return res.status(200).json([])

      let count = entries.length
      let arr = []
      entries.forEach(entry => {
        fs.lstat(path.join(req.body.abspath, entry), (err, stat) => {
          if (!err) {
            arr.push({
              name: entry,
              type: stat.isFile() ? 'file'
                : stat.isDirectory() ? 'directory'
                : stat.isSymbolicLink() ? 'link'
                : stat.isSocket() ? 'socket'
                : stat.isFIFO() ? 'fifo'
                : stat.isCharacterDevice() ? 'char'
                : stat.isBlockDevice() ? 'block' : 'unknown',
              size: stat.size,
              ctime: stat.ctime.getTime()
            })
          }
          if (!--count) res.status(200).json(arr)
        })
      })
    })
  } else {
    res.status(200).sendFile(req.body.abspath)
  }
})

/**
This function create a new dir or a new file in given directory.
When creating new dir, the content-type must be application/json.
When creating new file, the content-type must be multipart/form-data.
This function fails if given dir or file name already exists. It won't rename automatically.

@param {stream} req
@param {string} req.body.abspath - directory path
@param {string} [req.body.dirname] - required when mkdir
@param {string} [req.formdata.filename] - required when create new file
@returns 415 if content-type is neither application/json nor multipart/form-data
@returns 404 if path not found (including ENOTDIR error where an ancestor is not a dir)
@returns 403 if path is not a directory, with error cdoe ENOTDIR 
@returns 403 if dirname (dir) or filename (file) already exists, with error code EEXIST
@returns 400 if dirname invalid (dir) or filename invalid (file)
@returns 200 with file or directory object
*/
const mkdirOrNewFile = (req, res, next) => fs.lstat(req.body.abspath, (err, stat) => {
  if (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') err.status = 404
    return next(err)
  }

  if (!stat.isDirectory()) return res.status(403).json({ code: 'ENOTDIR', message: 'path is not a directory' })

  fs.readdir(req.body.abspath, (err, entries) => {
    if (err) return next(err)

    if (req.is('application/json')) {
      let dirname = req.body.dirname
      let invalid = typeof dirname !== 'string' || dirname.length === 0 || sanitize(dirname) !== dirname
      if (invalid) return res.status(400).json({ message: 'dirname must be a valid file name' })
      if (entries.includes(dirname)) return res.status(403).json({ code: 'EEXIST', message: 'dirname already exists' })

      let dirPath = path.join(req.body.abspath, dirname)
      fs.mkdir(dirPath, err => {
        if (err) return next(err)
        fs.lstat(dirPath, (err, stat) => {
          if (err) return next(err)
          if (!stat.isDirectory()) return next(new Error('type mismatch, race?'))
          res.status(200).json({ 
            name: dirname, 
            type: 'directory', 
            size: stat.size, 
            ctime: stat.ctime.getTime()
          })
        })
      })
    } else if (req.is('multipart/form-data')) {

      let finished = false
      let name, filePath
      let size = 0
      let form = new formidable.IncomingForm()

      form.on('fileBegin', (_name, file) => {
        if (finished) return

        let invalid = typeof file.name !== 'string' || file.name.length === 0 || sanitize(file.name) !== file.name
        if (invalid) {
          finished = true
          return res.status(400).json({ message: 'invalid file name' })
        }

        if (entries.includes(file.name)) {
          finished = true
          return res.status(403).json({ code: 'EEXIST', message: 'filename already exists' })
        }

        name = file.name
        filePath = file.path = path.join(req.body.abspath, file.name)
      })

      form.on('file', (name, file) => {
        if (finished) return
        size = file.size

        if (size === 0) {

          let invalid = typeof file.name !== 'string' || file.name.length === 0 || sanitize(file.name) !== file.name
          if (invalid) {
            finished = true
            return res.status(400).json({ message: 'invalid file name' })
          }

          if (entries.includes(file.name)) {
            finished = true
            return res.status(403).json({ code: 'EEXIST', message: 'filename already exists' })
          }

          name = file.name
          filePath = file.path = path.join(req.body.abspath, file.name)

          try {
            fs.closeSync(fs.openSync(filePath, 'a'))
          }
          catch(e) {
            finished = true
            next(e)
          }
        }
      })

      form.on('error', err => {
        if (finished) return
        finished = true
        next(err)
      })

      form.on('aborted', () => {
        finished = true
      })

      form.on('end', () => {
        if (finished) return
        fs.lstat(filePath, (err, stat) => {

          if (finished) return
          finished = true

          if (err) return next(err)
          if (!stat.isFile() || stat.size !== size) return next(new Error('type or size mismatch, race?'))
          res.status(200).json({ name, type: 'file', size, ctime: stat.ctime.getTime() })
        })
      })

      form.parse(req)
    } else {
      res.status(415).json({ message: 'content type must be either application/json or multipart/form-data' })
    }
  })
})

/**
This router function overwrites a file. path must be a regular file.

@param {stream} req
@param {string} req.body.abspath

@returns 404 if path ENOENT or ENOTDIR
@returns 403 if path is not a file
@returns 200
*/
const overwrite = (req, res, next) => fs.lstat(req.body.abspath, (err, stat) => {
  if (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') err.status = 404
    return next(err)
  }
  if (!stat.isFile()) return res.status(403).json({ message: 'path must be a file' })

  let finished = false
  let os = fs.createWriteStream(req.body.abspath)
  os.on('error', err => {
    if (finished) return
    finished = true
    next(err)
  })

  os.on('close', () => {
    if (finished) return
    finished = true
    res.status(200).end()
  })

  req.on('abort', () => {
    if (finished) return
    finished = true
    req.unpipe()
  })

  req.pipe(os)
})

/**
This router function delete target, including special file
returns 403 if path is '' (root)
returns 200 if success
*/
const del = (req, res, next) => req.body.path === ''
  ? res.status(403).json({ message: 'root cannot be deleted' })
  : rimraf(req.body.abspath, err => err ? next(err) : res.status(200).end())

/**
This router function rename files.
@param {stream} req
@param {string} req.body.oldPath
@param {string} req.body.newPath
@returns 403 if new path exists, with error code EEXIST
*/
const rename = (req, res, next) => {
  let invalid = typeof req.body.oldPath !== 'string' || req.body.oldPath.length === 0 || typeof req.body.newPath !== 'string' || req.body.newPath.length === 0
  if (invalid) return res.status(400).json({ message: 'invalid oldPath or newPath' })

  let mp = (req.body.block || req.body.volume).mountpoint

  let oldPath = path.join(mp, req.body.oldPath)
  let newPath = path.join(mp, req.body.newPath)

  fs.lstat(newPath, (err, stat) => {
    if (err && err.code === 'ENOENT') {
      fs.rename(oldPath, newPath, err => err ? next(err) : res.status(200).end())
    } else if (err) {
      next(err)
    } else {
      res.status(403).json({ code: 'EEXIST', message: 'newPath already exists' })
    }
  })
}

// const storageRefresh = (req, res, next) => {
//   refreshAsync()
//   .then(newStorage => {
//     if (!deepEqual(storage, newStorage)) broadcast.emit('StorageUpdate', null, newStorage)
//     next()
//   })
//   .catch(e => next(e))
// }

router.get('/', avail, (req, res, next) => res.status(200).json(storage))

// return blocks, no refresh
router.get('/blocks', avail, (req, res) => res.status(200).json(storage.blocks))

// list or download
router.get('/blocks/:name', avail, blockName, checkPath, listOrDownload)

// create dir or file (multipart/formdata), path must be a directory
router.post('/blocks/:name', avail, blockName, checkPath, mkdirOrNewFile)

// overwrite
router.put('/blocks/:name', avail, blockName, checkPath, overwrite)

// delete
router.delete('/blocks/:name', avail, blockName, checkPath, del)

// rename
router.patch('/blocks/:name', avail, blockName, rename)

// return volumes, no refresh
router.get('/volumes', avail, (req, res) => res.status(200).json(storage.volumes))

// create a new volume TODO validate body
router.post('/volumes', (req, res, next) =>
  mkfsBtrfsAsync(req.body)
    .then(uuid => res.status(200).json({ uuid }))
    .catch(e => next(e)))

// list or download
router.get('/volumes/:volumeUUID', avail, volumeUUID, checkPath, listOrDownload)

// create dir or file (multipart/form-data)
router.post('/volumes/:volumeUUID', avail, volumeUUID, checkPath, mkdirOrNewFile)

// overwrite
router.put('/volumes/:volumeUUID', avail, volumeUUID, checkPath, overwrite)

// delete
router.delete('/volumes/:volumeUUID', avail, volumeUUID, checkPath, del)

// rename
router.patch('/volumes/:volumeUUID', avail, volumeUUID, rename)

//
module.exports = router

// test hook
if (process.env.NODE_ENV === 'test') {

  Object.defineProperty(module.exports, 'storage', {
    get: function() {
      return storage
    },
    set: function(value) {
      storage = value
    }
  })
}

