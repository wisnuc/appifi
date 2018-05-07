const express = require('express')

/**
@module DriveRouter
*/
module.exports = (auth, DRIVE, DIR, DIRENTRY) => {
  const f = (res, next) => (err, data) =>
    err ? next(err) : data ? res.status(200).json(data) : res.status(200).end()

  let router = express.Router()

  // drive apis

  router.get('/', auth.jwt(), (req, res, next) => DRIVE.LIST(req.user, {}, f(res, next)))

  router.post('/', auth.jwt(), (req, res, next) => DRIVE.POST(req.user, req.body, f(res, next)))

  router.get('/:driveUUID', auth.jwt(), (req, res, next) =>
    DRIVE.GET(req.user, { driveUUID: req.params.driveUUID }, f(res, next)))

  router.patch('/:driveUUID', auth.jwt(), (req, res, next) =>
    DRIVE.PATCH(req.user, Object.assign({}, req.body, { driveUUID: req.params.driveUUID }), f(res, next)))

  router.delete('/:driveUUID', auth.jwt(), (req, res, next) =>
    DRIVE.DELETE(req.user, { driveUUID: req.params.driveUUID }, f(res, next)))

  // dir apis (nested)
/**
  router.get('/:driveUUID/dirs', auth.jwt(), (req, res, next) =>
    DIR.LIST(req.user, { driveUUID: req.params.driveUUID }, f(res, next)))
**/
  router.get('/:driveUUID/dirs/:dirUUID', auth.jwt(), (req, res, next) => {
    let { driveUUID, dirUUID } = req.params
    let { metadata, counter } = req.query
    DIR.GET(req.user, { driveUUID, dirUUID, metadata, counter }, f(res, next))
  })

  // dir entry apis (nested)
  router.post('/:driveUUID/dirs/:dirUUID/entries', auth.jwt(), (req, res, next) => {
    if (!req.is('multipart/form-data')) {
      let err = new Error('only multipart/form-data type supported')
      err.status = 415
      return next(err)
    }

    const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
    const m = regex.exec(req.headers['content-type'])

    let boundary = m[1] || m[2]
    let length = parseInt(req.headers['content-length'])
    let props = {
      driveUUID: req.params.driveUUID,
      dirUUID: req.params.dirUUID,
      boundary,
      length,
      formdata: req,
    }

    DIRENTRY.POSTFORM(req.user, props, f(res, next))
  })

  router.get('/:driveUUID/dirs/:dirUUID/entries/:fileUUID', auth.jwt(), (req, res, next) => {
    let { driveUUID, dirUUID, fileUUID } = req.params
    let { name: fileName } = req.query
    let props = { driveUUID, dirUUID, fileUUID, fileName }

    DIRENTRY.GET(req.user, props, (err, filePath) => err ? next(err) : res.status(200).sendFile(filePath))
  })

  return router
}
