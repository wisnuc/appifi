const express = require('express')
const store = require('lib/store')

const router = express.Router()

router.get('/', (req, res) => { 
  store((err, result) => {
    err ? res.status(500).json(err) :
      res.status(200).json(result)
  })
})

module.exports = router
