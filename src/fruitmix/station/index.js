const fs = require('fs')
const path = require('path')

const ursa = require('ursa')
const Promise = require('bluebird')
const Router = require('express').Router
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const broadcast = require('../../common/broadcast')
const auth = require('../middleware/auth')
const tickets = require('./route/tickets')
const Station = require('./lib/station')

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

// broadcast.emit('FruitmixStart', path.join(process.cwd(), 'tmptest'))

let router = Router()

// stationFinishStart,
router.use('/tickets', auth.jwt(), Station.stationFinishStart.bind(Station), tickets)

router.get('/info', auth.jwt(), (req, res) => {
  return res.status(200).json({
    "uuid": Station.sa.id,
    "name": "station name",
    "pubkey": Station.publicKey
  })
})

module.exports = router
