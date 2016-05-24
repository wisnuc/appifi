import express from 'express'
import store from 'lib/store'

const router = express.Router()

router.get('/', (req, res) => { 
  res.status(200).json(store.get())
})

router.post('/', (req, res) => {
  res.status(200).json(store.refresh())
})

module.exports = router

