import config from '../../config'

const router = require('express').Router()

router.get('/', (req, res) => {
  config.ipc.call('printFiles', null, (err, data) => {
    if (err) return res.status(500).json({ code: err.code, message: err.message })
    res.status(200).json(data) 
  })
})

module.exports = router
