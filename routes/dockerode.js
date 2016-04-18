'use strict'

var express = require('express')
var router = express.Router()

var docker = require('lib/docker')

router.get('/', (req, res, next) => {
  
  let obj = {
    appname: 'wisnuc docker manager',
    version: '0.1'
  }
  res.json(obj)
})

router.get('/ping', (req, res, next) => {

  docker.ping((err, result) => {
    res.json(result)
  })
})

router.get('/version', (req, res, next) => {

  docker.version((err, version) => {
    
    if (err)
      res.status(500).json(null)
    else
      res.json(version)
  })
})

router.get('/containers', (req, res, next) => {

  docker.listContainers((err, containers) => {
    
    if (err) 
      res.status(500).json(null)
    else
      res.json(containers)
  })
})

router.get('/containers/:containerid', (req, res, next) => {

  var containerid = req.params.containerid
  res.json({ containerid })

})

router.get('/images', (req, res, next) => {

  docker.listImages((err, images) => {
    
    if (err)
      res.status(500).json(null)
    else
      res.json(images)
  })
})

router.get('/images/search', (req, res, next) => {

  docker.searchImages({ term: 'ubuntu' }, (err, result) => {
    
    if (err)
      res.status(500).json(null)
    else
      res.json(result)
  }) 
})

module.exports = router

