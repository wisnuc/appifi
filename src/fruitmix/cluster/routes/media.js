const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Transform = require('stream').Transform

const router = require('express').Router()
const formidable = require('formidable')
const UUID = require('node-uuid')
const validator = require('validator')
const sanitize = require('sanitize-filename')

import paths from '../../lib/paths'
import config from '../../config'

// list, tree and nav a directory
router.get('/:type/:dirUUID/:rootUUID', (req, res) => {

  let userUUID = req.user.userUUID
  let { type, dirUUID, rootUUID } = req.params

  let typeArr = ['list', 'tree' ,'list-nav', 'tree-nav']
  if (typeArr.indexOf(type) === -1) return res.error(null, 400)

  let args = { userUUID, dirUUID, rootUUID }

  config.ipc.call(type, args, (err, data) => {
    if (err) return res.error(err)
    return res.success(data) 
  })
})

module.exports = router