const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')

const broadcast = require('../common/broadcast')
const getFruit = require('../fruitmix')

// return meta data of all I can view
router.get('/', auth.jwt(), (req, res) => {

  const user = req.user
  const fingerprints = getFruit().getFingerprints(user)
  const metadata = fingerprints.reduce((acc, fingerprint) => {
    let meta = getFruit().getMetadata(user, fingerprint)
    if (meta) acc.push(Object.assign({ hash: fingerprint }, meta))
    return acc
  }, [])

  res.status(200).json(metadata)
})


/**
  use query string, possible options:

  width: 'integer',
  height: 'integer'
  modifier: 'caret',      // optional
  autoOrient: 'true',     // optional

  width and height, provide at least one
  modifier effectvie only if both width and height provided
**/

router.get('/:fingerprint', auth.jwt(), (req, res, next) => {
  const user = req.user
  const fingerprint = req.params.fingerprint
  const query = req.query

  if (query.alt === undefined || query.alt === 'metadata') {
    let metadata = getFruit().getMetadata(user, fingerprint)
    if (metadata) {
      res.status(200).json(metadata)
    } else {
      res.status(404).end()
    }
  } else if (query.alt === 'data') {
    let files = getFruit().getFilesByFingerprint(user, fingerprint)

    if (files.length) {
      res.status(200).sendFile(files[0])
    } else {
      res.status(404).end()
    }
  } else if (query.alt === 'thumbnail') {

    getFruit().getThumbnail(user, fingerprint, query, (err, thumb) => {
      if (err) return next(err)
      if (typeof thumb === 'string') {
        res.status(200).sendFile(thumb)
      } else if (typeof thumb === 'function') {
        let cancel = thumb((err, th) => {
          if (err) return next(err)
          res.status(200).sendFile(th)
        })

        // TODO cancel
      } else {
        next(new Error(`unexpected thumb type ${typeof thumb}`))
      }
    })
  }
})

module.exports = router
