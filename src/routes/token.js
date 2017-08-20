const router = require('express').Router()
const jwt = require('jwt-simple')
const secret = require('../config/passportJwt')
const auth = require('../middleware/auth')

router.get('/', auth.basic(), (req, res) => 
  res.status(200).json({
    type: 'JWT',
    token: jwt.encode({ uuid: req.user.uuid }, secret)
  })) 

router.get('/verify', auth.jwt(), (req, res) => res.status(200).end())

module.exports = router

