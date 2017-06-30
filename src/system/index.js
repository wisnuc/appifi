const Promise = require('bluebird')
const child = require('child_process')
const os = require('os')

const router = require('express').Router()
const validator = require('validator')

const debug = require('debug')('system:index')

const Boot = require('./boot')
const Config = require('./config')
const Device = require('./device')
const Storage = require('./storage')

const { readFanSpeed, writeFanScale } = require('./barcelona')
const eth = require('./eth')
const { mac2dev, aliases, addAliasAsync, deleteAliasAsync } = require('./ipaliasing')
const { mkfsBtrfs } = require('./mkfs')


const nolog = (res) => Object.assign(res, { nolog: true })
const unsupported = res => res.status(404).json({ code: 'EUNSUPPORTED', message: 'not supported' })
const invalid = res => res.status(400).json({ code: 'EINVAL', message: 'invalid api arguments' })
const error = (res, err) => res.status(500).json({ code: err.code, message: err.message })
const ok = (res, obj) => res.status(200).json(obj ? obj : ({ message: 'ok' }))

/**
 *  GET /boot, return boot status
 */
router.get('/boot', (req, res) => {

  let obj = Object.assign({}, Boot.get(), {
    bootMode: Config.get().bootMode,
    lastFileSystem: Config.get().lastFileSystem,
    fruitmix: Boot.fruitmix ? Boot.fruitmix.getState() : null
  }) 

  // quick fix, TODO
  if (!obj.currentFileSystem) obj.currentFileSystem = null

  nolog(res).status(200).json(obj)
})

/**
 *  POST /boot
 *  {
 *    op: STRING_ENUM,      // 'poweroff', 'reboot', 'rebootMaintenance', 'rebootNormal' 
 *    target: STRING_UUID,  // file system uuid, required only if op === 'rebootNormal'
 *  }
 */
const isValidBootArgs = body => 
  typeof body === 'object' 
    && body !== null
    && !!['poweroff', 'reboot', 'rebootMaintenance', 'rebootNormal'].includes(body.op)
    && body.op === 'rebootNormal' 
      ? (typeof body.target === 'string' && validator.isUUID(body.target))
      : true

router.post('/boot', (req, res) =>
  !isValidBootArgs(req.body)
    ? invalid(res)
    : Boot.rebootAsync(req.body.op, req.body.target).asCallback(err =>
      err
        ? error(res, err)
        : ok(res)))


/**
  POST /run
  { 
    target: fsUUID 
  }
**/
const isValidRunArgs = body => 
  typeof body === 'object' 
    && body !== null 
    && typeof body.target === 'string' 
    && validator.isUUID(body.target)

router.post('/run', (req, res) => 
  !isValidRunArgs(req.body) 
    ? res.status(400).json({ code: 'EINVAL', message: 'invalid arguments' }) 
    : Boot.manualBootAsync(req.body, false).asCallback(err => err
      ? res.status(400).json({ code: err.code, message: err.message })
      : res.status(200).json({ message: 'ok' })))


module.exports = router
