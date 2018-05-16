const express = require('express')

/**
@module SambaRouter
*/
module.exports = (auth, { GET, PATCH }) => {
  const f = (res, next) => (err, data) =>
    err ? next(err) : data ? res.status(200).json(data) : res.status(200).end()

  let router = express.Router()

  router.get('/', auth.jwt(), (req, res, next) =>
    GET(f(res, next)))

  router.patch('/', auth.jwt(), (req, res, next) =>
    PATCH(req.user, req.body, f(res, next)))

  return router
}
