const Router = require('express').Router
const debug = require('debug')('station')

const Asset = require('../../lib/assertion')
const E = require('../../lib/error')
const Station = require('../lib/station')


const path = require('path')
const tmptest = path.join(process.cwd(), 'tmptest')
const broadcast = require('../../common/broadcast')
const Promise = require('bluebird')
const fs = require('fs')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const resetAsync = async() => {
  
    broadcast.emit('FruitmixStop')
  
    await rimrafAsync(tmptest)
   
    broadcast.emit('FruitmixStart', tmptest) 
  
    await broadcast.until('FruitmixStarted')
  }
  

let router = Router()

router.get('/info', (req, res) => {
  return res.status(200).json(Station.info())
})


// tmp
router.get('/reset', async (req, res) => {
  await resetAsync()
  return res.status(200).end()
})

module.exports = router