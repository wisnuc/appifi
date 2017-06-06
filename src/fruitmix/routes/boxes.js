const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')
const uuid = require('uuid')

router.get('/', (req, res) => {
  res.status(200).json([])
})

module.exports = router
