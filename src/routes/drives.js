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
router.get('/', fruitless, auth.jwt(), (req, res) => 
  res.status(200).json(getFruit().getDrives(req.user)))

/**
Create a fruitmix drive
*/
router.post('/', fruitless, auth.jwt(), (req, res, next) => 
  getFruit().createPublicDriveAsync(req.user, req.body)
    .then(drive => res.status(200).json(drive))
    .catch(next))

/**
Get single drive
*/
router.get('/:driveUUID', fruitless, auth.jwt(), (req, res, next) => 
  res.status(200).json(getFruit().getDrive(req.user, req.params.driveUUID)))

/**
Patch a drive, only public drive is allowed
*/
router.patch('/:driveUUID', fruitless, auth.jwt(), (req, res, next) => {
  let user = req.user
  let driveUUID = req.params.driveUUID
  getFruit().updatePublicDriveAsync(user, driveUUID, req.body)
    .then(drive => res.status(200).json(drive))
    .catch(next)
})

/**
Delete a public drive
*/
router.delete('/:driveUUID', fruitless, auth.jwt(), (req, res, next) => {
  res.status(403).json({ message: 'not implemented yet' })
})

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
  let user = req.user
  let { driveUUID, dirUUID } = req.params
  let metadata = req.query.metadata === 'true' ? true : false
  let r = await getFruit().getDriveDirAsync(user, driveUUID, dirUUID, metadata)
  res.status(200).json(r)
}))

/**
030 POST dir entries
*/
router.post('/:driveUUID/dirs/:dirUUID/entries', fruitless, auth.jwt(), 
  (req, res, next) => {
    if (!req.is('multipart/form-data')) {
      return res.status(415).json({ message: 'must be multipart/form-data' })
    }
    if(!getFruit().userCanWrite(user, req.params.driveUUID)) throw Object.assign(new Error('Permission Denied'), { status: 401})
    let writer = new Writedir(req)
    writer.on('finish', () => {
      if (writer.error) {
        next(writer.error)
      } else {
        next()
      }
    })
  },
  f(async (req, res) => {
    let user = req.user
    let { driveUUID, dirUUID } = req.params
    let r = await getFruit().getDriveDirAsync(user, driveUUID, dirUUID)
    res.status(200).json(r)
  }))

/**
040 GET a single entry (download a file)
*/
router.get('/:driveUUID/dirs/:dirUUID/entries/:entryUUID', fruitless, auth.jwt(), 
  f(async (req, res) => {
    let user = req.uesr
    let { driveUUID, dirUUID } = req.params
    let { name } = req.query

    // let dir = Forest.getDriveDir(driveUUID, dirUUID)
    let dirPath = getFruit().getDriveDirPath(user, driveUUID, dirUUID)
    let filePath = path.join(dirPath, name)

    // let xstat = await readXstatAsync(filePath)
    // confirm fileUUID TODO
    // move to fruitmix TODO

    res.status(200).sendFile(filePath)
  }))



module.exports = router

