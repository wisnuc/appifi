const Promise = require('bluebird')
const router = require('express').Router()
const uuid = require('uuid')
const jwt = require('jwt-simple')
const secret = require('../config/passportJwt')

const User = require('../user/user')
/**
This auth requires client providing:
1. both local user token AND wechat token
2. only wechat token (guest mode)

returns 401 if failed
*/
const auth = (req, res, next) => {

  let text = req.get('Authorization')
  if (typeof text !== 'string') 
    return res.status(401).end()

  let split = text.split(' ')

  if (split.length < 2 || split.length > 3 || split[0] !== 'JWT')
    return res.status(401).end()
 
  let wechat = jwt.decode(split[1]) 
  if (wechat.deadline > new Date().getTime())
    return res.status(401).end()

  if (split.length === 2) {
    req.guest = {
      unionId: wechat.unionId
    }
    return next()
  }

  let local = jwt.decode(split[2])
  let user = User.users.find(u => u.uuid === local.uuid)
  if (!user || user.unionId !== wechat.unionId)
    return res.status(401).end()

  req.user = user 
  next()
}

router.get('/', auth, (req, res) => {
  res.status(200).json([])
})

module.exports = router
