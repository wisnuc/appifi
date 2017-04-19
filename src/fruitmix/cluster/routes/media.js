
const router = require('express').Router()
import config from '../config'

// get mata data of all I can view
router.get('/', (req, res) => {

  let userUUID = req.user.userUUID

  config.ipc.call('getMeta', userUUID, (err, data) => {
    if (err) return res.error(err)
    return res.success(data) 
  })
})

router.get('/:digest/download', (req, res) => {

  let userUUID = req.user.userUUID
  let digest = req.params.digest
 
  config.ipc.call('readMedia', {userUUID, digest}, (err, filepath) => {
    if (err) return res.error(err)
    return res.status(200).sendFile(filepath)
  })
})

/**
  use query string, possible options:

  width: 'integer',
  height: 'integer'
  modifier: 'caret',      // optional
  autoOrient: 'true',     // optional
  instant: 'true',        // optional
  nonblock: 'true'        // optional

  width and height, provide at least one
  modifier effectvie only if both width and height provided
**/
  
router.get('/:digest/thumbnail', (req, res) => {

  //FIXME: delete
  // const user = req.user
  // const digest = req.params.digest
  // const query = req.query

  // const thumbnailer = models.getModel('thumbnailer')
  // thumbnailer.request(digest, query, (err, ret) => {

  //   if (err) return res.error(err)

  //   if (typeof ret === 'object') {
  //     res.status(202).json(ret)
  //   }
  //   else {
  //     res.status(200).sendFile(ret)
  //   }

    let userUUID = req.user.userUUID
    let digest = req.params.digest

    config.ipc.call('getThumbnail', { userUUID, digest, query }, (err, ret) => {
      if (err) return res.error(err)
      return res.status(200).sendFile(ret)
    })

  // })
})
module.exports = router