const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')
const uuid = require('uuid')

const User = require('../user/user')
const Drive = require('../drive/drive')
const File = require('../file/file')

router.get('/:nodeUUID', auth.jwt(), (req, res) => {

  let { nodeUUID } = req.params
  let node = File.findNodeByUUID(nodeUUID)
  if (!node)
    return res.status(404).end()

  if (node.isFile()) {
  
  }

  if (node.isDirectory()) {
  }

  res.status(500).json({ message: 'unsupported node type' })
})

module.exports = router

