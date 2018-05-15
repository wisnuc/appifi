const express = require('express')
const formidable = require('formidable')

/**
@module TransmissionRouter
*/
module.exports = (auth, { LIST, POST, PATCH }) => {
  const f = (res, next) => (err, data) =>
    err ? next(err) : data ? res.status(200).json(data) : res.status(200).end()

  let router = express.Router()

  router.get('/', auth.jwt(), (req, res, next) =>
    LIST(req.user, {}, f(res, next)))

  router.post('/magnet', auth.jwt(), (req, res, next) =>
    POST(req.user, Object.assign({}, req.body, { type: 'magnet' }), f(res, next)))

  router.post('/torrent', auth.jwt(), (req, res, next) => {
    POST(req.user, Object.assign({}, req.body, { type: 'torrent', req }), f(res, next))
  })

  router.patch('/:id', auth.jwt(), (req, res, next) =>
    PATCH(req.user, Object.assign({}, req.body, {id: req.params.id}), f(res, next)))

  return router
}
