const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')

const broadcast = require('../common/broadcast')
const getFruit = require('../fruitmix')
const UUID = require('uuid')

router.post('/start', (req, res) => {
    getFruit().startSambaAsync()
        .then(() => {
            res.status(200).json()
        })
        .catch(e => {
            res.status(500).json(e)
        })
})

router.post('/stop', (req, res) => {
    getFruit().smbServer.stopAsync()
        .then(() => {
            res.status(200).json()
        })
        .catch(e => {
            res.status(500).json(e)
        })
})

module.exports = router