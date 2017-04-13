
const router = require('express').Router()
import config from '../config'

// all metadata
router.get('/', (req, res) => {

  let userUUID = req.user.userUUID

  config.ipc.call('getMeta', userUUID, (err, data) => {
    if (err) return res.error(err)
    return res.success(data) 
  })
})

module.exports = router