const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')
const UUID = require('uuid')

module.exports = (auth, fruit) => {

  const EFruitless = new Error('fruitmix service unavailable')
  EFruitless.status = 503

  const fruitless = (req, res, next) => fruit() ? next() : next(EFruitless)

  // User List, GET
  router.get('/', fruitless, 
    // for display users 
    (req, res, next) => {
      if (req.get('Authorization')) return next()   
      res.status(200).json(fruit().displayUsers())
    }, 
    auth.jwt(), 
    // for authorized users
    (req, res) => {
      if (req.user.isFirstUser) {
        res.status(200).json(fruit().getUsers())
      } else {
        res.status(200).json(fruit().displayUsers())
      }
    })

  // User List, POST
  router.post('/', fruitless, 
    (req, res, next) => {
      if (fruit().hasUsers()) return next()
      fruit().createUserAsync(null, req.body) 
        .then(user => res.status(200).json(user))
        .catch(next)
    }, 
    auth.jwt(), 
    (req, res, next) => {
      fruit().createUserAsync(req.user, req.body) 
        .then(user => res.status(200).json(user))
        .catch(next)
    })

  // get single user 
  router.get('/:uuid', auth.jwt(), (req, res) => {
    let user = fruit().getUsers().find(u => u.uuid === req.params.uuid)
    if (!user) {
      res.status(404).end()
    } else if (req.user.isFirstUser || req.user.uuid === req.params.uuid) {
      res.status(200).json(user)
    } else {
      res.status(403).end()
    }
  })

  // update name, isAdmin, disabled 
  router.patch('/:userUUID', fruitless, auth.jwt(), (req, res, next) => {
    let { userUUID } = req.params
    fruit().updateUserAsync(req.user, userUUID, req.body)
      .then(user => res.status(200).json(user))
      .catch(next)
  })

  // update (own) password
  router.put('/:uuid/password', auth.basic(), (req, res, next) => {
    fruit().updateUserPasswordAsync(req.user, req.params.uuid, req.body)
      .then(() => res.status(200).end())
      .catch(next)
  })

  return router
}

