const router = require('express').Router()

const token = require('./routes/token')
const users = require('./routes/users')
const drives = require('./routes/drives')
const boxes = require('./routes/boxes')
const wxtoken = require('./routes/wxtoken')
const uploads = require('./routes/uploads')

router.use('/token', token)
router.use('/users', users)
router.use('/drives', drives)
router.use('/boxes', boxes)
router.use('/wxtoken', wxtoken)
router.use('/uploads', uploads)

module.exports = router
