const router = require('express').Router()

const config = require('../config')

router.get('/', (req, res) => {

  config.ipc.call('ipctest', 'hello', (err, data) => {

    if (err) return res.status(500).json({
      err: {
        code: err.code,
        message: err.message
      }
    })
  
    res.status(200).json({ data })
  })

})

module.exports = router

