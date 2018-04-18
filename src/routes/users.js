const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')
const UUID = require('uuid')

/**
@module UserRouter
*/
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
      if (fruit().users.length) return next()
      fruit().user.createUser(req.body, (err, user) => {
        if(err) return next(err)
        res.status(200).json(auth.strip(user))
      })
    }, 
    auth.jwt(), 
    (req, res, next) => {
      if (!req.user.isFirstUser) return next(Object.assign(new Error('only admin can create user'), { status: 401 }))
      fruit().user.createUser(req.body, (err, user) => {
        if(err) return next(err)
        res.status(200).json(user)
      })
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

  // update name, disabled 
  router.patch('/:userUUID', fruitless, auth.jwt(), (req, res, next) => {
    let { userUUID } = req.params
    if (!req.user.isFirstUser && req.user.uuid !== userUUID) 
      return next(Object.assign(new Error('only first user can update others'), { status: 403 }))
    if (!req.user.isFirstUser && req.body.disabled)
      return next(Object.assign(new Error('only first user can update disabled'), { status: 403 }))
    fruit().user.updateUser(userUUID, req.body, (err, user) => {
      if (err) return next(err)
      res.status(200).json(auth.strip(user))
    })
  })

  // update (own) password
  router.put('/:uuid/password', auth.basic(), (req, res, next) => {
    if (req.user.uuid !== req.params.uuid) 
      return next(Object.assign(new Error('only can update yourself'), { status: 403 }))
    fruit().user.updatePassword(req.params.uuid, req.body, (err, user) => {
      if (err) return next(err)
      res.status(200).json(auth.strip(user))
    })
  })

  return router
}

