const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const http = require('http')
const querystring = require('querystring')
const UUID = require('uuid')
const router = require('express').Router()
const auth = require('../middleware/auth')

const Drive = require('../drive/drive')
const File = require('../file/file')
const { readXstatAsync } = require('../file/xstat')
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

router.get('/:driveUUID/dirs', auth.jwt(), (req, res) => {

  let { driveUUID } = req.params

  let root = File.roots.find(r => r.uuid === driveUUID)
  if (!root) res.status(404).end()

  res.status(200).json([
    {
      uuid: root.uuid,
      name: root.name,
      mtime: root.mtime
    }
  ])
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

router.post('/:driveUUID/dirs', auth.jwt(), f(async (req, res) => {

  let { driveUUID } = req.params
  
  let parent = File.findDirectoryByUUID(req.body.parent) 
  if (!parent) 
    return res.status(404).end()

  let parentPath = parent.abspath()
  let xstat = await readXstatAsync(parentPath)
  let dirPath = path.join(parent.abspath(), req.body.name)

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

  xstat = await readXstatAsync(dirPath)
  res.status(200).json({
    uuid: xstat.uuid,
    name: xstat.name,
    mtime: xstat.mtime
  })

}))

/**
get single directory object
*/
router.get('/:driveUUID/dirs/:dirUUID', auth.jwt(), f(async(req, res) => {

  let { driveUUID, dirUUID } = req.params
  let dir = File.findDirectoryByUUID(dirUUID)
  if (!dir) return res.status(404).end()

  let dirPath = dir.abspath() 
  let xstat = await readXstatAsync(dirPath)

  res.status(200).json({
    uuid: xstat.uuid,
    parent: dir.parent,
    name: xstat.name,
    mtime: xstat.mtime
  })
}))

/**
list single directory 
*/
router.get('/:driveUUID/dirs/:dirUUID/list', auth.jwt(), f(async(req, res) => {

  let { driveUUID, dirUUID } = req.params
  let dir = File.findDirectoryByUUID(dirUUID)
  if (!dir) return res.status(404).end()

  let dirPath = dir.abspath() 
  let xstat = await readXstatAsync(dirPath)

  res.status(200).json({
    uuid: xstat.uuid,
    parent: dir.parent,
    name: xstat.name,
    mtime: xstat.mtime
  })
}))

// rename a directory
router.patch('/:driveUUID/dirs/:dirUUID', auth.jwt(), (req, res) => {

  let { driveUUID, dirUUID } = req.params
 
  let node = File.findNodeByUUID(dirUUID)
  if (!node) res.status(404).end()

  File.renameDirAsync(node, req.body.name) 
    .then(node => res.status(200).json({
      uuid: node.uuid,
      name: node.name,
      mtime: node.mtime,
    }))
    .catch(e => console.log(e) || error(e))
})

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
router.post('/:driveUUID/dirs/:dirUUID/files', auth.jwt(), (req, res) => {

  if (!req.is('multipart/form-data'))
    return res.status(403).json({ message: 'this api accepts only formdata' })

  let { driveUUID, dirUUID } = req.params

  formdata(req, (err, ret) => {

    if (err) return res.status(500).end()
    res.status(200).end()
  })
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

