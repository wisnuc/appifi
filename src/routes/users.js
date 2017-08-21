const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')
const UUID = require('uuid')
const getFruit = require('../fruitmix')

const EUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EUnavail)

// User List, GET
router.get('/', fruitless, 
  // for display users 
  (req, res, next) => {
    let fruit = getFruit()
    if (req.get('Authorization')) return next()   
    res.status(200).json(fruit.displayUsers())
  }, 
  auth.jwt(), 
  // for authorized users
  (req, res) => {
    let fruit = getFruit()
    if (req.user.isAdmin) {
      res.status(200).json(fruit.getUsers())
    } else {
      res.status(200).json(fruit.displayUsers())
    }
  })

// User List, POST
router.post('/', fruitless, 
  (req, res, next) => {
    let fruit = getFruit()
    if (fruit.hasUsers()) return next()
    fruit.createUserAsync(req.body) 
      .then(user => res.status(200).json(user))
      .catch(next)
  }, 
  auth.jwt(), 
  (req, res, next) => {
    let fruit = getFruit()
    fruit.createUserAsync(req.body) 
      .then(user => res.status(200).json(user))
      .catch(next)
  })

// get single user 
router.get('/:uuid', auth.jwt(), (req, res) => {
  
  let uuid = req.params.uuid
  let user = req.user

  if (user.uuid === uuid) return res.status(200).json(user)

  if (user.isAdmin) {
    let u = User.findUser(uuid) 
    if (u) 
      res.status(200).json(u)
    else
      res.status(404).end()

    return
  }

  res.status(403).end() // TODO message? 
})

// update name, isAdmin, disabled 
router.patch('/:userUUID', fruitless, auth.jwt(), (req, res, next) => {
  let { userUUID } = req.params
  getFruit().updateUserAsync(req.user, userUUID, req.body)
    .then(user => res.status(200).json(user))
    .catch(next)
})

// update (own) password
router.put('/:uuid/password', auth.basic(), (req, res, next) => {
  getFruit().updateUserPasswordAsync(req.user, req.body)
    .then(() => res.status(200).end())
    .catch(next)
})

router.get('/:userUUID/media-blacklist', auth.jwt(), (req, res, next) => {
  getFruit().getMediaBlacklistAsync(req.user)
    .then(list => res.status(200).json(list))
    .catch(next)
})

router.put('/:userUUID/media-blacklist', auth.jwt(), (req, res, next) => {
  getFruit().setMediaBlacklistAsync(req.user, req.body)
    .then(list => res.status(200).end())
    .catch(next)
})

router.post('/:userUUID/media-blacklist', auth.jwt(), (req, res, next) => {
  getFruit().addMediaBlacklistAsync(req.user, req.body)  
    .then(list => res.status(200).json(list))
    .catch(next)
})

router.delete('/:userUUID/media-blacklist', auth.jwt(), (req, res, next) => {
  getFruit().subtractMediaBlacklistAsync(req.user, req.body)
    .then(list => res.status(200).json(list))
    .catch(next)
})

module.exports = router

