const express = require('express')

/**
@module routes/Token
*/

/**
Creates a token router.

An Auth object is required for basic/jwt authentication and generating token for authenticated user.

@param {Auth} auth - authentication
@returns {object} express router
*/
module.exports = auth => {
  let router = express.Router()
  router.get('/', auth.basic(), (req, res) => res.status(200).json(auth.token(req.user)))
  router.get('/verify', auth.jwt(), (req, res) => res.status(200).end())
  return router
}
