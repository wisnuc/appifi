const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const UUID = require('uuid')
const router = require('express').Router()

const auth = require('../middleware/auth')
const broadcast = require('../../common/broadcast')

const Drive = require('../models/drive')
const Forest = require('../forest/forest')
const { readXstatAsync, forceXstatAsync } = require('../lib/xstat')
const formdata = require('./formdata')
const { upload, uploadAsync } = require('../lib/sidekick-client')

const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(mkdirp)

const f = af => (req, res, next) => af(req, res).then(x => x, next)

let fruitmixPath

broadcast.on('FruitmixStart', froot => (fruitmixPath = froot))
broadcast.on('FruitmixStop', () => (fruitmixPath = undefined))

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

  if (!Forest.roots.has(driveUUID)) return res.status(404).end()

  res.status(200).json(Forest.getDriveDirs(driveUUID))
})

/**
020 * create a new dir (mkdir)
*/
router.post('/:driveUUID/dirs', auth.jwt(), f(async (req, res) => {
  let { driveUUID } = req.params

  let parent = Forest.getDriveDir(driveUUID, req.body.parent)
  if (!parent) return res.status(404).end()

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

/**
031 * list a dir
*/
router.get('/:driveUUID/dirs/:dirUUID/list', auth.jwt(), 
  f(async(req, res) => {
    let { driveUUID, dirUUID } = req.params
    let dir = Forest.getDriveDir(driveUUID, dirUUID)
    if (!dir) return res.status(404).end()

    let xstats = await dir.readdirAsync()
    res.status(200).json(xstats)
  }))

/**
032    listnav a dir
*/
router.get('/:driveUUID/dirs/:dirUUID/listnav', auth.jwt(),
  f(async(req, res) => {
    let { driveUUID, dirUUID } = req.params
    let dir = Forest.getDriveDir(driveUUID, dirUUID)
    if (!dir) return res.status(404).end()

    let list = await dir.readdirAsync()
    let nav = dir.nodepath().map(dir => ({
      uuid: dir.uuid,
      parent: dir.parent ? dir.parent.uuid : '',
      name: dir.name,
      mtime: Math.abs(dir.mtime)
    }))

    res.status(200).json({ path: nav, entries: list })
  }))

/**
040 * patch a directory (rename)
*/
router.patch('/:driveUUID/dirs/:dirUUID', auth.jwt(),
  f(async(req, res) => {
    let { driveUUID, dirUUID } = req.params
    let { name } = req.body

    let dir = Forest.getDriveDir(driveUUID, dirUUID)
    if (!dir) return res.status(404).end()
    if (Forest.isRoot(dir)) return res.status(403).end()

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
    if (!dir) return res.status(404).end()
    if (Forest.isRoot(dir)) return res.status(403).end()

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
        if (e.code !== 'EEXIST') throw e
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
    }
    else 
      res.status(500).end()
  }))

module.exports = router

