const router = require('express').Router()
const jwt = require('jwt-simple')
const secret = require('../config/passportJwt')
const auth = require('../middleware/auth')

router.get('/', auth.jwt(), (req, res) => {

  let user = req.user
  if (user.unionId) {
    let token = {
      unionId: user.unionId,
      time: new Date().getTime()  
    }
    res.status(200).json({ type: 'JWT', token: jwt.encode(token, secret) })
  }
  else {
    res.status(404).end()
  }
})

// { token: xxxxx }
router.post('/decode', (req, res) => {

  let decoded
  try { 
    decoded = jwt.decode(req.body.token, secret)
    res.status(200).json(decoded)
  }
  catch (e) {
    res.status(500).json({
      type: e.constructor.name,
      code: e.code,
      message: e.message
    })
  }
})

module.exports = router
