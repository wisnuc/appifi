
const UUID = require('node-uuid')
const router = require('express').Router()
import config from '../config'

// get mata data of all I can view
router.get('/', (req, res) => {

  let userUUID = req.user.uuid

  config.ipc.call('getMeta', userUUID, (err, data) => {
    if (err) return res.error(err)
    console.log('metadata:' ,data)
    return res.success(data) 
  })
})

router.get('/:digest/download', (req, res) => {

  let userUUID = req.user.uuid
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

  let requestId = UUID.v4() 
  let userUUID = req.user.uuid
  let digest = req.params.digest
  let query = req.query

  config.ipc.call('getThumb', { requestId, userUUID, digest, query }, (err, ret) => {
    if (err) {
      return res.error(err)
    }

    req.on('close', () => {
      config.ip.call('abort', requestId, () => {
        req.end()
      })
    })

    console.log('ret:', ret);
    if (typeof ret === 'object') {
      return res.status(202).json(ret)
    }
    else {
      return res.status(200).sendFile(ret)
    }
  })

})

module.exports = router
