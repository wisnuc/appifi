const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const router = require('express').Router()
const auth = require('../middleware/auth')
const UUID = require('uuid')
const { isSHA256, isUUID } = require('../lib/assertion')
const getFruit = require('../fruitmix')
const Debug = require('debug')
const debug = Debug('Tags')

const EFruitUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EFruitUnavail) 

// only support tag
router.get('/', auth.jwt(), fruitless, (req, res, next) => {
  let user = req.user
  if(typeof req.query.tag !== 'string' || !req.query.tag.length) return res.status(400).json({ message:'tag not found'})
  let tags = req.query.tag
              .split('+')
              .filter(t => t.length)
              .map(t => {
                let tId = parseInt(t)
                if(Number.isInteger(tId)) return tId
                return null
              })
              .filter(t => t !== null)
  if(!Array.isArray(tags) || !tags.length) return res.status(400).json({ message:'tag not found'})
  getFruit().getTagedFiles(user, tags, (err, data) => {
    if(err) return next(err)
    res.status(200).json(data)
  })
})

router.get('/:fileUUID', auth.jwt(), fruitless, (req, res, next) => {
  let filepath = getFruit().getFilePathByUUID(req.user, req.params.fileUUID)
  if(filepath) return res.status(200).sendFile(filepath)
  res.status(404).json({ message: 'file not found' })
})

module.exports = router
