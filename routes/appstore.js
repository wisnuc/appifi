import express from 'express'
import appstore from 'lib/appstore'

const router = express.Router()

router.get('/', (req, res) => { 
  res.status(200).json(appstore.get())
})

router.post('/', (req, res) => {
  appstore.refresh((e, r) => {
    if (e)
      return res.status(500)
    
    res.status(200).json(r)
  }) 
})

module.exports = router

