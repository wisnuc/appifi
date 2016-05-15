const express = require('express')
const docker = require('lib/docker')

const router = express.Router()

router.get('/', (req, res) => {

  res.status(200).json(docker.get())
})

router.get('/status', (req, res) => {

  res.status(200).json(docker.status())
})

router.post('/', (req, res) => { 
  docker(req.body, (err, result) => {
    err ? res.status(500).json(err) :
      res.status(200).json(result)
  })
})

module.exports = router

