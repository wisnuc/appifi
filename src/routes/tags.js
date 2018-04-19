const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const stream = require('stream')
const crypto = require('crypto')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const router = require('express').Router()
const sanitize = require('sanitize-filename')
const UUID = require('uuid')

const { isSHA256, isUUID } = require('../lib/assertion')

const Debug = require('debug')
const debug = Debug('Tags')


module.exports = (auth, fruit) => {
  const EFruitless = new Error('fruitmix service unavailable')
  EFruitless.status = 503

  const fruitless = (req, res, next) => fruit() ? next() : next(EFruitless)

  router.get('/', fruitless, auth.jwt(), (req, res, next) => {
    let tags = fruit().getTags(req.user)
    res.status(200).json(tags)
  })
  
  router.post('/', fruitless, auth.jwt(), (req, res, next) => {
    let props = req.body
    fruit().createTag(req.user, props, (err, tag) => {
      if (err) return next(err)
      res.status(200).json(tag)
    })
  })
  
  router.get('/:tagId', fruitless, auth.jwt(), (req, res, next) => {
    let tag = fruit().getTag(req.user, parseInt(req.params.tagId))
    if(tag) return res.status(200).json(tag)
    res.status(404).end()
  })
  
  router.patch('/:tagId', fruitless, auth.jwt(), (req, res, next) => {
    fruit().updateTag(req.user, parseInt(req.params.tagId), req.body, (err, tag) => {
      if (err) return next(err)
      res.status(200).json(tag)
    })
  })
  
  router.delete('/:tagId', fruitless, auth.jwt(), (req, res, next) => {
    fruit().deleteTag(req.user, parseInt(req.params.tagId), err => {
      if (err) return next(err)
      res.status(200).end()
    })
  })
  
  return router
}