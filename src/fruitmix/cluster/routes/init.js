const router = require('express').Router()

import config from '../config'

router.post('/', (req, res) => {

  if (typeof req.body !== 'object' || req.body === null) 
    return res.status(400).json({ code: 'EINVAL', message: 'invalid arguments' }) 

  let props = Object.assign(req.body, { type: 'local' })
  config.ipc.call('createLocalUser', { props: req.body }, (err, firstUser) => {
    if (err) 
      return res.status(500).json({ code: err.code, message: err.message })
    else
      return res.status(200).json(firstUser)
  })
})

export default router
