const Router = require('express').Router
const debug = require('debug')('station')

const Asset = require('../../lib/assertion')
const E = require('../../lib/error')
const Station = require('../lib/station')

let router = Router()

router.get('/info', (req, res) => {
  return res.status(200).json(Station.info())
})

router.patch('/info', (req, res, next) => {
  let { name } = req.body 
  if(!name) return next(Object.assign(new Error('patch station name error!'), { status: 400 }))
  Station.updateInfoAsync({ name })
    .then(station => res.status(200).json(station))
    .catch(next)
})

module.exports = router