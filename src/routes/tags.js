const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const stream = require('stream')
const crypto = require('crypto')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const router = require('express').Router()
const auth = require('../middleware/auth')
const sanitize = require('sanitize-filename')
const UUID = require('uuid')
const { isSHA256, isUUID } = require('../lib/assertion')
const getFruit = require('../fruitmix')
const Debug = require('debug')
const debug = Debug('Tags')

const fruitless = (req, res, next) => getFruit() ? next() : next(EFruitUnavail)


router.get('/', fruitless, auth.jwt(), (req, res, next) => {
  let tags = getFruit().getTags(req.user)
  res.status(200).json(tags)
})

router.post('/', fruitless, auth.jwt(), (req, res, next) => {
  let props = req.body
  getFruit().createTagAsync(req.user, props)
    .then(tag => res.status(200).json(tag))
    .catch(next)
})

router.get('/:tagId', fruitless, auth.jwt(), (req, res, next) => {
  let tag = getFruit().getTag(req.user, req.params.tagId)
  if(tag) return res.status(200).json(tag)
  res.status(404).end()
})

router.patch('/:tagId', fruitless, auth.jwt(), (req, res, next) => {
  getFruit().updateTagAsync(req.user, req.params.tagId, req.body)
    .then(tag => req.status(200).json(tag))
    .catch(next)
})

router.delete('/:tagId', fruitless, auth.jwt(), (req, res, next) => {
  getFruit().deleteTagAsync(req.user, req.params.tagId)
    .then(x => res.status(200).end())
    .catch(next)
})

module.exports = router