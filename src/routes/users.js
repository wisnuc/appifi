const express = require('express')

/**
@module UserRouter
*/
module.exports = (auth, { LIST, POST, GET, PATCH, DELETE }) => {

  const f = (res, next) => (err, data) => 
    err ? next(err) : data ? res.status(200).json(data) : res.status(200).end()

  let router = express.Router()

  // List
  router.get('/', 
    (req, res, next) => req.get('Authorization') ? next() : LIST(null, {}, f(res, next)),
    auth.jwt(), 
    (req, res, next) => LIST(req.user, {}, f(res, next)))

  // POST
  router.post('/',
    (req, res, next) => req.get('Authorization') ? next() : POST(null, req.body, f(res, next)),
    auth.jwt(),
    (req, res, next) => POST(req.user, req.body, f(res, next)))

  // GET
  router.get('/:userUUID', auth.jwt(), (req, res, next) =>
    GET(req.user, { userUUID: req.params.userUUID }, f(res, next)))

  // PATCH
  router.patch('/:userUUID', (req, res, next) => {
    if (req.body.password) return auth.basic()(req, res, next)
    auth.jwt()(req, res, next)
  }, (req, res, next) =>
    PATCH(req.user, Object.assign({}, req.body, { userUUID: req.params.userUUID }), f(res, next)))

  // DELETE
  router.delete('/:userUUID', auth.jwt(), (req, res, next) => 
    DELETE(req.user, { userUUID: req.params.userUUID }, f(res, next)))

  return router
}


