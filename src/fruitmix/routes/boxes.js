const Promise = require('bluebird')
const router = require('express').Router()
const uuid = require('uuid')
const jwt = require('jwt-simple')
const secret = require('../config/passportJwt')

const User = require('../models/user')
const Box = require('../box/box')

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

  let wechat = jwt.decode(split[1], secret) 
  if (wechat.deadline < new Date().getTime()) {
    console.log('overdue')
    return res.status(401).end()
  }

  if (split.length === 2) {
    req.guest = {
      unionId: wechat.unionId
    }
    return next()
  }

  let local = jwt.decode(split[2], secret)
  let user = User.users.find(u => u.uuid === local.uuid)
  if (!user || user.unionId !== wechat.unionId)
    return res.status(401).end()
  req.user = User.stripUser(user)
  next()
}

router.get('/', auth, (req, res) => {

  // console.log('auth', req.user, req.guest)
  let unionId
  if(req.user) unionId = req.user.unionId
  else unionId = req.guest.unionId

  let boxes = [...Box.map.values()].filter(box => 
              box.owner === unionId ||
              box.users.includes(unionId))
  res.status(200).json(boxes)
})

router.post('/', auth, (req, res, next) => {

  if (!req.user) return res.status(403).end()

  let props = Object.assign({}, req.body, { owner: req.user.unionId })

  Box.createBoxAsync(props)
    .then(box => res.status(200).json(box))
    .catch(next)
})

router.get('/:boxUUID', auth, (req, res) => {
  let boxUUID = req.params.boxUUID

  let box = Box.map.get(boxUUID)
  if(!box) return res.status(404).end()

  let unionId
  if(req.user) unionId = req.user.unionId
  else unionId = req.guest.unionId

  if(box.owner !== unionId && !box.users.includes(unionId)) return res.status(403).end()

  res.status(200).json(box)
})

router.patch('/:boxUUID', auth, (req, res, next) => {

  if(!req.user) return res.status(403).end()

  let boxUUID = req.params.boxUUID

  let box = Box.map.get(boxUUID)
  if(!box) return res.status(404).end()
  if(box.owner !== req.user.unionId) return res.status(403).end()
  Box.updateBoxAsync(req.body, box)
    .then(box => res.status(200).json(box))
    .catch(next)
})

router.delete('/:boxUUID', auth, (req, res, next) => {
  if(!req.user) return res.status(403).end()

  let boxUUID = req.params.boxUUID

  let box = Box.map.get(boxUUID)
  if(!box) return res.status(404).end()
  if(box.owner !== req.user.unionId) return res.status(403).end()
  Box.deleteBoxAsync(boxUUID)
    .then(() => res.status(200).end())
    .catch(next)
})

router.get('/:boxUUID/branches', auth, (req, res) => {
  let boxUUID = req.params.boxUUID
  let box = Box.map.get(boxUUID)
  if(!box) return res.status(404).end()



  res.status(200).end()
})

router.post('/:boxUUID/branches', auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let box = Box.map.get(boxUUID)
  if(!box) return res.status(404).end()

  let props = req.body
  box.createBranchAsync(boxUUID, props)
    .then(branch => res.status(200).end(branch))
    .catch(next)
})

module.exports = router
