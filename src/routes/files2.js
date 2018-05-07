const express = require('express')

module.exports = (auth, { LIST, GET }) => {

  let router = express.Router()

  router.get('/', auth.jwt(), (req, res, next) => 
    LIST(req.user, {
      places: req.query.places,
      tags: req.query.tags,
      magics: req.query.magics,
      metadata: req.query.metadata,
      namepath: req.query.namepath 
    }, (err, data) => err ? next(err) : res.status(200).json(data)))

  router.get('/:fileUUID', auth.jwt(), (req, res, next) => 
    GET(req.user, { fileUUID: req.params.fileUUID }, (err, data) => 
      err ? next(err) : res.status(200).sendFile(data)))

  return router
}
