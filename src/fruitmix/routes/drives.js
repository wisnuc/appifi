// const Promise = require('bluebird')
const path = require('path')

const router = require('express').Router()

const auth = require('../middleware/auth')
// const broadcast = require('../../common/broadcast')

const Drive = require('../models/drive')
const Forest = require('../forest/forest')
// const { readXstatAsync } = require('../lib/xstat')

const f = af => (req, res, next) => af(req, res).then(x => x, next)

/**
let fruitmixPath
broadcast.on('FruitmixStart', froot => (fruitmixPath = froot))
broadcast.on('FruitmixStop', () => (fruitmixPath = undefined))
**/

/**
Get a fruitmix drive
*/
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

/**
Create a fruitmix drive
*/
router.post('/', auth.jwt(), (req, res) => {
  let props = req.body
  Drive.createPublicDriveAsync(props)
    .then(drive => res.status(200).json(drive))
    .catch(e => res.status(500).json({ code: e.code, message: e.message }))
})

/**
010 GET dirs
*/
router.get('/:driveUUID/dirs', auth.jwt(), (req, res) => {
  let { driveUUID } = req.params

  if (!Forest.roots.has(driveUUID)) { return res.status(404).end() }

  res.status(200).json(Forest.getDriveDirs(driveUUID))
})

/**
020 GET single dir
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

/**
030 POST dir entries
*/
router.post('/:driveUUID/dirs/:dirUUID/entries', auth.jwt(), (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return res.status(415).json({ message: 'must be multipart/form-data' })
  }

  let { driveUUID, dirUUID } = req.params
  let dir = Forest.getDriveDir(driveUUID, dirUUID)
  if (!dir) { return res.status(404).end() }

  dir.write(req, err => err ? res.status(500).end() : res.status(200).end())
})

/**
040 GET a single entry (download a file)
*/
router.get('/:driveUUID/dirs/:dirUUID/entries/:entryUUID', auth.jwt(), f(async (req, res) => {
  let { driveUUID, dirUUID } = req.params
  let { name } = req.query

  let dir = Forest.getDriveDir(driveUUID, dirUUID)

  let filePath = path.join(dir.abspath(), name)
  // let xstat = await readXstatAsync(filePath)
  // confirm fileUUID TODO

  res.status(200).sendFile(filePath)
}))

module.exports = router

