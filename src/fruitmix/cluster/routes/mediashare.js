const router = require('express').Router()

import config from '../../config'

router.get('/', (req, res) => {
  config.ipc.call('getMediaShares', {}, (err, data) => {
  })
})

router.post('/', (req, res) => {
  config.ipc.call('createMediaShare', req.body, (err, data) => {
  })
})

router.patch('/:shareUUID', (req, res) => {
  config.ipc.call('updateMediaShare', req.body, (err, data) => {
  })
})

router.delete('/:shareUUID', (req, res) => {
  config.ipc.call('deleteMediaShare', req.body, (err, data) => {
  })
})

module.exports = router

