const router = require('express').Router()
const jwt = require('jwt-simple')
const secret = require('../config/passportJwt')
const auth = require('../middleware/auth')

router.get('/', auth.jwt(), (req, res) => {

  let user = req.user
  if (user.unionId) {
    let token = {
      unionId: user.unionId,
      deadline: new Date().getTime() + 4 * 60 * 60 * 1000
    }
    res.status(200).json({ type: 'JWT', token: jwt.encode(token, secret) })
  }
  else {
    res.status(404).end()
  }
})

// { token: xxxxx }
router.post('/decode', (req, res) => {

  let decoded = jwt.decode(req.body.token, secret)
  res.status(200).json(decoded)
})

module.exports = router
