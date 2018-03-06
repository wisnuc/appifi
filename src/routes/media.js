const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')

const broadcast = require('../common/broadcast')
const getFruit = require('../fruitmix')
const UUID = require('uuid')

// return meta data of all I can view
router.get('/', auth.jwt(), (req, res) => {
  const user = req.user
  const metadata = getFruit().getMetaList(user)
  res.status(200).json(metadata)
})

// key: uuid
// value: { userUUID, fingerprint, atime }
const map = new Map()

setInterval(() => {
  let time = new Date().getTime()
  let keys = []
  for (let p of map) {
    if (time - p[1].atime > 24 * 3600 * 1000) {
      keys.push(p[0])
    }
  } 

  keys.forEach(k => map.delete(k))
}, 1000 * 60)

router.get('/random/:key', (req, res, next) => {

  let key = req.params.key 
  let val = map.get(key)
  if (!val) {
    res.status(404).end()
    return
  }

  let user = getFruit().getUserByUUID(val.userUUID)
  if (!user) {
    map.delete(key)
    res.status(404).end()
    return
  }

  let files = getFruit().getFilesByFingerprint(user, val.fingerprint)
  if (files.length) {
    val.atime = new Date().getTime()
    res.status(200).sendFile(files[0])
  } else {
    map.delete(key)
    res.status(404).end()
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
    if(query.boxUUID) {
      try{
        let fp = getFruit().getBoxFilepath(user, query.boxUUID, fingerprint)
        return res.status(200).sendFile(fp)
      }
      catch(e) { return next(e) }
    }
    let files = getFruit().getFilesByFingerprint(user, fingerprint)

    if (files.length) {
      res.status(200).sendFile(files[0])
    } else {
      res.status(404).end()
    }
  } else if (query.alt === 'thumbnail') {
    if (query.boxUUID) {
      try{
        let fp = getFruit().getBlobMediaThumbnail(user, fingerprint, query, (err, thumb) => {
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
      catch(e) { return next(e) }
    }
    else 
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
  } else if (query.alt === 'random') {
    let files = getFruit().getFilesByFingerprint(user, fingerprint)  
   
    if (files.length) {
      let key = UUID.v4()
      let val = {
        userUUID: user.uuid,
        fingerprint,
        atime: new Date().getTime() 
      }
      map.set(key, val)
      res.status(200).json({ key })
    } else {
      res.status(404).end()
    }
  }
})

module.exports = router
