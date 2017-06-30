const Promise = require('bluebird')

const router = require('express').Router()

const Boot = require('../boot')
const Config = require('../config')

router.get('/', (req, res) => {

  let { state, error } = Boot
  let { bootMode, lastFileSystem } = Config.config

  console.log(Config.config)

  let currentFileSystem = Boot.currentFileSystem 
    ? ({
        type: Boot.currentFileSystem.type,
        uuid: Boot.currentFileSystem.uuid
      })
    : null

  res.status(200).json({ mode: bootMode, lastFileSystem, 
    state, error, currentFileSystem })
})

module.exports = router
