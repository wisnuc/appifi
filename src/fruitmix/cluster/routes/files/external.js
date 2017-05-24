const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const router = require('express').Router()
const validator = require('validator')
const UUID = require('node-uuid')
const sanitize = require("sanitize-filename")
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))

/**

mkdir or upload
POST /external/[appifi|fs]/:uuid/path/to/directory
PUT  /external/[appifi|fs]/:uuid/path/to/file

rename
{ name: 'newfilename' }
PATCH /external/[appifi|fs]/:uuid/path/to/directory/or/file

delete
DELETE /external/[appifi|fs]/:uuid/path/to/directory/or/file

**/

const isUUID = text => typeof text === 'string' && validator.isUUID(text)
const isNormalizedPath = rpath => typeof rppath === 'string' && path.normalize(rpath) === rpath
const isSanitizedName = name => typeof name === 'string' && sanitize(name) === name

const rootPathAsync = async (type, uuid) => {

  if (type !== 'fs') throw new Error('type not supported, yet')
  if (uuid !== undefined && !isUUID(uuid)) throw new Error(`Bad uuid ${uuid}`)

  let storage = JSON.parse(await fs.readFileAsync('/run/wisnuc/storage'))
  let { blocks, volumes } = storage
  if (!Array.isArray(blocks) || !Array.isArray(volumes)) throw new Error('bad storage format')

  /** TODO this function should be in sync with extractFileSystem in boot.js **/
  let fileSystems = [
    ...blocks.filter(blk => blk.isFileSystem 
      && !blk.isVolumeDevice
      && blk.isMounted), // no limitation for file system type
    ...volumes.filter(vol => vol.isFileSystem
      && !vol.isMissing
      && vol.isMounted)
  ]

  if (!uuid) {
    return fileSystems
  } 

  let target = fileSystems.find(fsys => fsys.fileSystemUUID === uuid)
  if (!target) throw new Error('not found')
  return target.mountpoint
}

const tmpFile = () => {
  if (config.path) 
    return path.join(config.path, 'tmp')
  throw new Error()
}

// relpath empty is OK
const readdirOrDownloadAsync = async (type, uuid, relpath) => {

  if ( type === 'fs'
    && isUUID(uuid)
    && typeof relpath === 'string'
    && (relpath.length === 0 || isNormalizedPath(relpath))) {}
  else
    throw new Error('invalid arguments')

  let rootpath = await rootPathAsync(type, uuid)
  let abspath = path.join(rootpath, relpath)
  let stats = await fs.lstatAsync(abspath) 

  if (stats.isDirectory()) {

    let entries = await fs.readdirAsync(abspath)
    let statEntryAsync = async entry => {

      try {
        let s = await fs.lstatAsync(path.join(abspath, entry))
        if (s.isDirectory()) 
          return { type: 'directory', name: entry, size: s.size, mtime: s.mtime.getTime() }
        else if (s.isFile())
          return { type: 'file', name: entry, size: s.size, mtime: s.mtime.getTime() }
        else 
          return { type: 'unsupported', name: entry }
      }
      catch (e) {
        return null
      }
    }

    return await Promise
      .all(entries.map(entry => statEntryAsync(entry)))
      .filter(r => r !== null)
  }
  else if (stats.isFile()) {
    return abspath
  }
  throw new Error('unsupported file type') 
}

// mkdirp is OK
const mkdirAsync = async (type, uuid, relpath) => {

  if ( type === 'fs'
    && isUUID(uuid)
    && typeof relpath === 'string'
    && isNormalizedPath(relpath)) {}
  else
    throw new Error('invalid arguments')

  let rootpath = await rootPathAsync(type, uuid) 
  let abspath = path.join(rootpath, relpath)
  await mkdirpAsync(abspath)
}

// return path
const uploadAsync = async (type, uuid, relpath) => {

  if (type === 'fs'
    && isUUID(uuid)
    && typeof relpath === 'string'
    && isNormalizedPath(relpath)) {}
  else
    throw new Error('invalid arguments')

  let rootpath = await rootPathAsync(type, uuid) 
  let abspath = path.join(rootpath, relpath)
  try {
    await fs.lstatAsync(abspath)
    throw new Error('already exists')
  }
  catch (e) {
    if (e.code !== 'ENOENT') throw e 
  }

  return abspath 
}

// basename => name 
const renameAsync = async (type, uuid, relpath, name) => {

  if ( type === 'fs'
    && isUUID(uuid)
    && typeof relpath === 'string'
    && isNormalizedPath(relpath)
    && isSanitizedName(name)) {}
  else
    throw new Error('invalid arguments')

  let rootpath = await rootPathAsync(type, uuid)
  let oldpath = path.join(rootpath, relpath)
  let newpath = path.join(path.dirname(oldpath), name)    
  await fs.rename(oldpath, newpath)
}

// rimraf is OK
const deleteAsync = async (type, uuid, relpath) => {

  if ( type === 'fs'
    && isUUID(uuid)
    && typeof relpath === 'string'
    && isNormalizedPath(relpath)) {}
  else
    throw new Error('invalid arguments')

  let rootpath = await rootPathAsync(type, uuid) 
  let abspath = path.join(rootpath, relpath)
  await rimrafAsync(abspath)
}

router.get('/fs', (req, res) => 
  rootPathAsync('fs')
    .then(fileSystems => res.status(200).json(fileSystems))
    .catch(e => e.code === 'EINVAL'
      ? res.status(400).json({ code: 'EINVAL', message: e.message })
      : res.status(400).json({ code: e.code, message: e.message })))


/**
list or download
GET /external/[appifi|fs]/:uuid/path/to/directory/or/file
**/
router.get('/:type/:uuid/*', (req, res) => {
  console.log('***************',req.params[0].length === 0)
  readdirOrDownloadAsync(req.params.type, req.params.uuid, req.params[0])
    .then(data => res.status(200).json(data))
    .catch(e => e.code === 'EINVAL'
      ? res.status(400).json({ code: 'EINVAL', message: e.message })
      : res.status(500).json({ code: e.code, message: e.message }))})

/**
mkdir
POST /external/[appifi|fs]/:uuid/path/to/directory
**/
router.post('/:type/:uuid/*', (req, res) => 
  mkdirAsync(req.params.type, req.params.uuid, req.params[0])
    .then(() => res.status(200).json({ message: 'ok' }))
    .catch(e => e.code === 'EINVAL'
      ? res.status(400).json({ code: 'EINVAL', message: e.message })
      : res.status(500).json({ code: e.code, message: e.message })))

/**
upload
PUT 
**/
router.put('/:type/:uuid/*', (req, res) => 
  uploadAsync(req.params.type, req.params.uuid, req.params[0])
    .then(abspath => { 
      let finished = false
      let stream = fs.createWriteStream(abspath)
      stream.on('error', err => {
        if (finished) return
        res.status(500).json({ code: err.code, message: err.message })
        finished = true
      })
      stream.on('close', () => {
        if (finished) return
        res.status(200).json({ message: 'ok' }) 
        finished = true
      })
      req.pipe(stream)
    })
    .catch(e => e.code === 'EINVAL'
      ? res.status(400).json({ code: 'EINVAL', message: e.message })
      : res.status(500).json({ code: e.code, message: e.message })))

/**
rename
{ name: 'newfilename' }
PATCH /external/[appifi|fs]/:uuid/path/to/directory/or/file
**/
router.patch('/:type/:uuid/*', (req, res) => 
  renameAsync(req.params.type, req.params.uuid, req.params[0], req.body.name)
    .then(() => res.status(200).json({ message: 'ok' }))
    .catch(e => e.code === 'EINVAL'
      ? res.status(400).json({ code: 'EINVAL', message: e.message })
      : res.status(500).json({ code: e.code, message: e.message })))

/**
delete
DELETE /external/[appifi|fs]/:uuid/path/to/directory/or/file
**/
router.delete('/:type/:uuid/*', (req, res) => 
  deleteAsync(req.params.type, req.params.uuid, req.params[0], req.body.name)
    .then(() => res.status(200).json({ message: 'ok' }))
    .catch(e => e.code === 'EINVAL'
      ? res.status(400).json({ code: 'EINVAL', message: e.message })
      : res.status(500).json({ code: e.code, message: e.message })))




module.exports = router
