import express from 'express'
import server from 'lib/server'

const router = express.Router()

router.get('/', (req, res) => res.status(200).json(server.get()))
router.get('/status', (req, res) => res.status(200).json(server.status()))

module.exports = router
