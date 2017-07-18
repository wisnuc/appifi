const path = require('path')

const Router = require('express').Router

const broadcast = require('../../common/broadcast')
const auth = require('../middleware/auth')
const tickets = require('./route/tickets')
const Station = require('./lib/station')

// broadcast.emit('FruitmixStart', path.join(process.cwd(), 'tmptest'))
// setTimeout(() => {
//   broadcast.emit('FruitmixStop', path.join(process.cwd(), 'tmptest'))
// }, 2000)

// setTimeout(() => {
//   broadcast.emit('FruitmixStart', path.join(process.cwd(), 'tmptest'))
// }, 4000)

let router = Router()

// stationFinishStart,
router.use('/tickets', auth.jwt(), Station.stationFinishStart.bind(Station), tickets)

router.use('/', require('./route/station'))

module.exports = router
