const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const http = require('http')
const querystring = require('querystring')
const UUID = require('uuid')
const router = require('express').Router()
const auth = require('../middleware/auth')

const Drive = require('../models/drive')
const Forest = require('../forest/forest')
const { readXstatAsync } = require('../models/xstat')
const formdata = require('./formdata')

const success = (res, data) => data
  ? res.status(200).json(data)
  : res.status(200).end()

router.get('/', auth.jwt(), (req, res) => {

  let drives = Drive.drives.filter(drv => {
    if (drv.type === 'private' && drv.owner === req.user.uuid)
      return true
    if (drv.type === 'public') {
      if (drv.writelist.includes(req.user.uuid) ||
        drv.readlist.includes(req.user.uuid))
      return true
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


// get all directories in a drive
router.get('/:driveUUID/dirs', auth.jwt(), (req, res) => {

  let { driveUUID } = req.params

  if (!Forest.roots.has(driveUUID)) 
    return res.status(404).end()

  res.status(200).json(Forest.getDriveDirs(driveUUID))
})

const mkdirAsync = async (pnode, name) => {

  let abspath = pnode.abspath()
  await fs.mkdirAsync(path.join(abspath, name))
  let xstat = await readXstatAsync(abspath)
  console.log(xstat)
}

const error = (res, e) => 
  console.log(e) || res.status(500).json({
    code: e.code,
    message: e.message
  })

const f = af => (req, res, next) => af(req, res).then(x => x, next)


// create a new directory in a drive
router.post('/:driveUUID/dirs', auth.jwt(), f(async (req, res) => {

  let { driveUUID } = req.params

  let parent = Forest.getDriveDir(driveUUID, req.body.parent)
  if (!parent) return res.status(404).end()

  let dirPath = path.join(parent.abspath(), req.body.name)

  // TODO let xstat = await readXstatAsync(parentPath)

  try {
    await fs.mkdirAsync(dirPath)
  }
  catch (e) {
    if (e.code === 'ENOENT') {
    } 
    else if (e.code === 'ENOTDIR') {
    }
    else {
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
get single dir in a drive
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
list single dir in a drive
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
listnav single dir in a drive
*/
router.get('/:driveUUID/dirs/:dirUUID/listnav', auth.jwt(), 
  f(async(req, res) => {

  let { driveUUID, dirUUID } = req.params
  let dir = Forest.getDriveDir(driveUUID, dirUUID)
  if (!dir) return res.status(404).end()

  let xstats = await dir.readdirAsync()
  res.status(200).json({
    path: [],
    entries: xstats
  })
}))

/** 
rename a directory
*/
router.patch('/:driveUUID/dirs/:dirUUID', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID } = req.params
 
  let node = Forest.findNodeByUUID(dirUUID)
  if (!node) res.status(404).end()

  Forest.renameDirAsync(node, req.body.name) 
    .then(node => res.status(200).json({
      uuid: node.uuid,
      name: node.name,
      mtime: node.mtime,
    }))
    .catch(e => console.log(e) || error(e))
})

/**
*/
router.delete('/:driveUUID/dirs/:dirUUID', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID } = req.params
  res.status(200).end()
})

// [/drives/{driveUUID}/dirs/{dirUUID}/files]
router.get('/:driveUUID/dirs/:dirUUID/files', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID } = req.params
  res.status(200).end()
})

// create a new file
router.post('/:driveUUID/dirs/:dirUUID/files', auth.jwt(), (req, res, next) => {

    let { driveUUID, dirUUID } = req.params

    req.formdata = { 
      filePath: path.join(_fruitmixPath, 'tmp', UUID.v4()) 
    }

    next()

  }, formdata, (req, res) => {

    let { driveUUID, dirUUID } = req.params
    let { filePath, fileName, size, sha256 } = req.formdata

    

    res.status(200).end()
})

// [/drives/{driveUUID}/dirs/{dirUUID}/files/{fileUUID}]
router.get('/:driveUUID/dirs/:dirUUID/files/:fileUUID', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID, fileUUID } = req.params
  res.status(200).end()
})

router.patch('/:driveUUID/dirs/:dirUUID/files/:fileUUID', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID, fileUUID } = req.params
  res.status(200).end()
})

router.delete('/:driveUUID/dirs/:dirUUID/files/:fileUUID', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID, fileUUID } = req.params
  res.status(200).end()
})


// [/drives/{driveUUID}/dirs/{dirUUID}/files/{fileUUID}/data]
router.get('/:driveUUID/dirs/:dirUUID/files/:fileUUID/data', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID, fileUUID } = req.params
  res.status(200).end()
})

router.put('/:driveUUID/dirs/:dirUUID/files/:fileUUID/data', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID, fileUUID } = req.params
  res.status(200).end()
})

module.exports = router

