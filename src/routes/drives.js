const Promise = require('bluebird')
const path = require('path')
const router = require('express').Router()
const auth = require('../middleware/auth')

const getFruit = require('../fruitmix')
const Writedir = require('../tasks/writedir')

const f = af => (req, res, next) => af(req, res).then(x => x, next)

const EFruitUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EFruitUnavail) 

/**
Get a fruitmix drive
*/
router.get('/', fruitless, auth.jwt(), (req, res) => {
  let fruit = getFruit()
  res.status(200).json(fruit.getDrives(req.user))
})

/**
Create a fruitmix drive
*/
router.post('/', fruitless, auth.jwt(), (req, res, next) => 
  getFruit().createPublicDriveAsync(req.user, req.body)
    .then(drive => res.status(200).json(drive))
    .catch(next))

/**
010 GET dirs
*/
router.get('/:driveUUID/dirs', fruitless, auth.jwt(), (req, res, next) => {

/**
  let { driveUUID } = req.params
  if (!Forest.roots.has(driveUUID)) { return res.status(404).end() }
  res.status(200).json(Forest.getDriveDirs(driveUUID))
**/

  try {
    let dirs = getFruit().getDriveDirs(req.user, req.params.driveUUID)

    res.status(200).json(dirs)
  } catch (e) {
    next(e)
  }
})

/**
020 GET single dir
*/
router.get('/:driveUUID/dirs/:dirUUID', fruitless, auth.jwt(), f(async(req, res) => {

/**
  let { driveUUID, dirUUID } = req.params
  let dir = Forest.getDriveDir(driveUUID, dirUUID)
  if (!dir) { return res.status(404).end() }

  let list = await dir.readdirAsync()
  let nav = dir.nodepath().map(dir => ({
    uuid: dir.uuid,
    name: dir.name,
    mtime: Math.abs(dir.mtime)
  }))
**/

    let r = await getFruit().getDriveDirAsync(req.user, req.params.driveUUID, req.params.dirUUID)

    // console.log('-------------------', r)

    res.status(200).json(r)
/**
  res.status(200).json({
    path: nav,
    entries: list
  })
**/
}))

/**
030 POST dir entries
*/
router.post('/:driveUUID/dirs/:dirUUID/entries', fruitless, auth.jwt(), (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return res.status(415).json({ message: 'must be multipart/form-data' })
  }

/**
  let { driveUUID, dirUUID } = req.params
  let dir = Forest.getDriveDir(driveUUID, dirUUID)
  if (!dir) { return res.status(404).end() }

  dir.write(req, err => {
    if (err) {
      res.status(500).json({
        code: err.code,
        message: err.message,
        where: err.where
      })
    } else {
      res.status(200).end()
    }
  })
**/

  let writer = new Writedir(req)
  writer.on('finish', () => {
    if (writer.error) 
      next(writer.error)
    else
      res.status(200).end()
  })
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

