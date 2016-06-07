import express from 'express'
import storage from 'lib/storage'

const router = express.Router()

/**
router.post('/', (req, res) => { 
  storage(req.body, (err, result) => {
    err ? res.status(500).json(err) :
      res.status(200).json(result)
  })
})
**/

router.post('/', (req, res) =>
  storage.operation(req.body, (err, result) => { 
    console.log(req.body)
    console.log(err)
    console.log(result)
    return err ? res.status(500).json(err) :
      res.status(200).json(result)
  }))

module.exports = router

