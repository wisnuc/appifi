const express = require('express')

module.exports = (auth, { GET }) => {
  const f = (res, next) => (err, data) =>
    err ? next(err) : data ? res.status(200).json(data) : res.status(200).end()

  let router = express.Router()
  router.get('/:fp', auth.jwt(), (req, res, next) =>
    GET(req.user, { fingerprint: req.params.fp, query: req.query }, f(res, next)))

  return router
}
