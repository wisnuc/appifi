const express = require('express')
import docker from '../lib/docker'

const router = express.Router()

router.post('/', (req, res) =>  
  docker.operation(req.body, (err, result) => 
    err ? res.status(500).json(err) :
      res.status(200).json(result)))

module.exports = router

