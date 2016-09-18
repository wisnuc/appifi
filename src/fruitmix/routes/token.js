const router = require('express').Router()
const jwt = require('jwt-simple')
import { secret } from '../config/passportJwt'
import auth from '../middleware/auth'

router.get('/', auth.basic(), (req, res) => {
  res.status(200).json({
    type: 'JWT',
    token: jwt.encode({ uuid: req.user.uuid }, secret)
  })  
})

module.exports = router

