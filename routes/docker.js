const express = require('express')
const docker = require('lib/docker')

const router = express.Router()

router.head('/', (req, res) => {

  res.status(200).json(docker.head())
})

router.get('/', (req, res) => {

  res.status(200).json(docker.get())
})

router.post('/', (req, res) => { 
  docker(req.body, (err, result) => {
    err ? res.status(500).json(err) :
      res.status(200).json(result)
  })
})

module.exports = router

