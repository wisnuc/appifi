import express from 'express'
import server from '../lib/server'

const router = express.Router()

router.get('/', (req, res) => res.status(200).json(server.get()))
router.get('/status', (req, res) => res.status(200).json(server.status()))

router.post('/', (req, res) =>  
  server.operation(req.body, (err, result) => 
    err ? res.status(200).json({
        err: err.message,
        ecode: err.code
      }) :
      res.status(200).json({
        err: null,
        result
      })))

module.exports = router

