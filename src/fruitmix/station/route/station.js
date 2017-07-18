const Router = require('express').Router
const debug = require('debug')('station')

const Asset = require('../../lib/assertion')
const E = require('../../lib/error')
const Station = require('../lib/station')

let router = Router()

router.get('/info', (req, res) => {
  return res.status(200).json(Station.info())
})

module.exports = router