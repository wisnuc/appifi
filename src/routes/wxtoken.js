const router = require('express').Router()
const jwt = require('jwt-simple')
const secret = require('../config/passportJwt')
const auth = require('../middleware/auth')
const boxData = require('../box/boxData')
const User = require('../models/user')


const userInfo = (req, res, next) => {
  let global = req.query.global
  let text = req.get('Authorization')

  if (text) {
    let split = text.split(' ')
    let local = jwt.decode(split[1], secret)
    let user = User.users.find(u => u.uuid === local.uuid)
    if (!user || user.global !== global)
      return res.status(401).end()
    req.user = User.stripUser(user)
    next()
  } else {
    let exist = [...boxData.map.values()].find(box => (box.doc.users.includes(global)
                || box.doc.owner === global))
    if (!exist) return res.status(401).end()
    req.user = { global }
    next()
  }
}

router.get('/', userInfo, (req, res) => {
  let user = req.user
  if (user.global) {
    let token = {
      global: user.global,
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
