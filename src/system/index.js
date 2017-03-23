const child = require('child_process')
const os = require('os')


const router = require('express').Router()
import validator from 'validator'

const debug = require('debug')('system:index')

import mir from './mir'
import { mac2dev, aliases, addAliasAsync, deleteAliasAsync } from './ipaliasing'
import eth from './eth'

import { readFanSpeed, writeFanScale } from './barcelona'


const Device = require('./device')
const Config = require('./config')
const Boot = require('./boot')

const codeMap = new Map([ ['EINVAL', 400], ['ENOENT', 404] ]) 




const nolog = (res) => {
  res.nolog = true
  return res 
}

const K = x => y => x
const respond = (res, err, obj) => err ? 
    res.status(codeMap.get(err.code) || 500)
      .json({ code: err.code, message: err.message }) :
    res.status(200)
      .json((obj === null || obj === undefined) ? { message: 'success' } : obj)

const timedate = (callback) => 
  child.exec('timedatectl', (err, stdout, stderr) => 
    err ? callback(err) : callback(null, stdout.toString().split('\n').filter(l => l.length)
      .reduce((prev, curr) => {
        let pair = curr.split(': ').map(str => str.trim())
        prev[pair[0]] = pair[1]
        return prev
      }, {})))

// device
router.get('/device', (req, res) => 
  res.status(200).json(Device.get()))


// timedate
router.get('/timedate', (req, res) => timedate((err, obj) => 
  err ? K(res.status(500).end())(console.log(err)) : res.status(200).json(obj)))

// network
router.get('/net', (req, res) => eth().asCallback((err, obj) => 
  err ? K(res.status(500).end())(console.log(err)) : res.status(200).json(obj))) 

// aliasing
router.get('/ipaliasing', (req, res) => res.status(200).json(aliases()))

router.post('/ipaliasing', (req, res) => (async () => {

  let { mac, ipv4 } = req.body
  if (typeof mac !== 'string' || !validator.isMACAddress(mac))
    throw Object.assign(new Error('invalid mac'), { code: 'EINVAL' })
  if (typeof ipv4 !== 'string' || !validator.isIP(ipv4, 4))
    throw Object.assign(new Error('invalid ipv4'), { code: 'EINVAL' })

  let existing = aliases().find(alias => alias.mac === mac) 
  if (existing) 
    await deleteAliasAsync(existing.dev, existing.ipv4)
  
  let dev = mac2dev(mac)
  if (!dev) 
    throw Object.assign(new Error('no interface found with given mac'), { code: 'ENOENT' })

  await addAliasAsync(dev, ipv4)
  return aliases().find(alias => alias.mac === mac)

})().asCallback((err, obj) => respond(res, err, obj)))

router.delete('/ipaliasing', (req, res) => (async () => {
    
  let { mac, ipv4 } = req.body

  if (typeof mac !== 'string' || !validator.isMACAddress(mac))
    throw Object.assign(new Error('invalid mac'), { code: 'EINVAL' })
  if (typeof ipv4 !== 'string' || !validator.isIP(ipv4, 4))
    throw Object.assign(new Error('invalid ipv4'), { code: 'EINVAL' })

  let existing = aliases().find(alias => alias.mac === mac)
  console.log(existing)
  if (existing) 
    await deleteAliasAsync(existing.dev, existing.ipv4)

})().asCallback((err, obj) => respond(res, err, obj)))

//
// fan
//
router.get('/fan', (req, res) => {

  if (!Device.isWS215i()) 
    return res.status(404).json({
      message: 'not available on this device'
    })

  readFanSpeed((err, fanSpeed) => {
    err ? res.status(500).json({ message: err.message }) :
      res.status(200).json({
        fanSpeed, fanScale: Config.get().barcelonaFanScale
      })
  })
})

router.post('/fan', (req, res) => {

  if (!Device.isWS215i())
    return res.status(404).json({
      message: 'not available on this device'
    })

  let { fanScale } = req.body
  writeFanScale(fanScale, err => {
    if (err) 
    return res.status(500).json({ message: err.message })

    storeDispatch({
      type: 'CONFIG_BARCELONA_FANSCALE',
      data: fanScale
    })

    res.status(200).json({ message: 'ok' })  
  })
})

router.use('/storage', mir)
router.use('/mir', mir)

router.get('/boot', (req, res) => {

  let boot = Boot.get()

  if (boot)
    nolog(res).status(200).json(boot)
  else 
    res.status(500).end() // TODO
})

const shutdown = (cmd) =>
  setTimeout(() => {
    child.exec('echo "PWRD_LED 3" > /proc/BOARD_io', err => {})
    child.exec(`${cmd}`, err => {})
  }, 1000)

router.post('/boot', (req, res) => {

  let obj = req.body
  if (obj instanceof Object === false)
    return res.status(400).json({ message: 'invalid arguments, req.body is not an object'})

  if (['poweroff', 'reboot', 'rebootMaintenance', 'rebootNormal'].indexOf(obj.op) === -1)
    return res.status(400).json({ message: 'op must be poweroff, reboot, or rebootMaintenance' }) 

  if (obj.target) {
    // if target is provided
    if (obj.op !== 'rebootNormal')
      return res.status(400).json({ message: 'target can only be used when op is rebootNormal' })

    // validate target FIXME
  }

  if (obj.op === 'poweroff') {

    console.log('[system] powering off')
    shutdown('poweroff')
  }
  else if (obj.op === 'reboot') {

    console.log('[system] rebooting')
    shutdown('reboot')
  }
  else if (obj.op === 'rebootMaintenance') {

    console.log('[system] rebooting into maintenance mode')
    storeDispatch({
      type: 'CONFIG_BOOT_MODE',
      data: 'maintenance'
    })
    shutdown('reboot')
  }
  else if (obj.op === 'rebootNormal') {

    console.log('[system] rebooting into normal mode')

    if (obj.target) {
      storeDispatch({
        type: 'CONFIG_BOOT_TARGET',
        data: {
          type: 'btrfs',
          uuid: target
        }
      })
    }
    else {
      storeDispatch({
        type: 'CONFIG_BOOT_TARGET'
      })
    }
    shutdown('reboot')
  }

  res.status(200).json({
    message: 'ok'
  })
})

module.exports = router
