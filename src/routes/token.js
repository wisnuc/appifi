const router = require('express').Router()
const auth = require('../middleware/auth')

const getFruit = require('../fruitmix')

const EUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EUnavail)

router.get('/', fruitless, auth.basic(), (req, res) => 
  res.status(200).json(getFruit().getToken(req.user))) 

router.get('/verify', auth.jwt(), (req, res) => res.status(200).end())

module.exports = router

