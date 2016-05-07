const express = require('express')
const supervisor = require('lib/supervisor')

const router = express.Router()

router.post('/', (req, res) => { 
  supervisor(req.body, (err, result) => {
    err ? res.status(500).json(err) :
      res.status(200).json(result)
  })
})

module.exports = router

