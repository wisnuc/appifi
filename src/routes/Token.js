const express = require('express')

/**
Creates a token router
@module TokenRouter
*/

/**
Creates a token router
@param {Auth} auth - Auth object
@returns {object} express router
*/
const TokenRouter = auth => {
  let router = express.Router()
  router.get('/', auth.basic(), (req, res) => res.status(200).json(auth.token(req.user)))
  router.get('/verify', auth.jwt(), (req, res) => res.status(200).end())
  return router
}

module.exports = TokenRouter
