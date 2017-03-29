const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const router = require('express').Router()

router.get('/hello', (req, res) => {
  res.status(200).end()
})

module.exports = router
