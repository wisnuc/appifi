import express from 'express'
import appstore from '../lib/appstore'

const router = express.Router()

router.get('/', (req, res) => { 
  appstore.reload()
  res.status(200).json({})
})

module.exports = router

