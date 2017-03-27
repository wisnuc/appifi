const router = require('express').Router()

import config from '../config'

router.post('/', (req, res) => {

  config.ipc.call('createFirstUser', { req.body }, (err, firstUser) => {
    if (err) 
      return res.status(500).json({
        code: err.code,
        message: err.message
      })

    return res.status(200).json(firstUsre)
  })
})
