const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

const router = require('express').Router()
const auth = require('../middleware/auth')

const broadcast = require('../common/broadcast')

// const User = require('../models/user')
// const Drive = require('../models/drive')
const Forest = require('../forest/forest')

const Media = require('../media/media')

const Thumbnail = require('../lib/thumbnail')

const getFruit = require('../fruitmix')

let thumbnail = null

broadcast.on('FruitmixStart', froot => {
  thumbnail = new Thumbnail(froot, 4)
})

broadcast.on('FruitmixStop', () => thumbnail && thumbnail.abort())

// return meta data of all I can view
router.get('/', auth.jwt(), (req, res) => {

  const user = req.user
  const fingerprints = getFruit().getFingerprints(user)
  const metadata = fingerprints.reduce((acc, fingerprint) => {
    let meta = Media.get(fingerprint)
    if (meta) acc.push(Object.assign({ hash: fingerprint }, meta))
    return acc
  }, [])

  res.status(200).json(metadata)
})

router.get('/:fingerprint', auth.jwt(), (req, res, next) => {
  const user = req.user
  const fingerprint = req.params.fingerprint
  const query = req.query

  if (query.alt === undefined || query.alt === 'metadata') {
    let metadata = Media.get(fingerprint)
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
    let files = getFruit().getFilesByFingerprint(user, fingerprint)
    if (files.length) {
      thumbnail.requestAsync(fingerprint, query, files)
        .then(thumb => {
          if (typeof thumb === 'string') {
            res.status(200).sendFile(thumb)
          } else { // TODO
            thumb.on('finish', (err, thumb) => {
              if (err) {
                next(err)
              } else {
                res.status(200).sendFile(thumb)
              }
            })
          }
        })
        .catch(next)
    } else {
      res.status(400).end()
    }
  }
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

module.exports = router
