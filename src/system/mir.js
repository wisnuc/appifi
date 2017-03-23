const path = require('path')
const router = require('express').Router()

import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import validator from 'validator'
import Debug from 'debug'

import { mkfsBtrfs } from './mkfs'
import { fakeReboot } from './boot'
import { adaptStorage, initFruitmix, probeFruitmix, probeAllFruitmixes } from './adapter'

const debug = Debug('system:mir')
const router = express.Router()

const nolog = res => Object.assign(res, { nolog: true })

const decorateStorageAsync = async () => {

  let mps = [] 
  let pretty = Storage.get(true)

  pretty.volumes.forEach(vol => {
    if (vol.isMounted && !vol.isMissing) mps.push({
      ref: vol,
      mp: vol.mountpoint
    })
  })

  /** no ext4 probe now
  pretty.blocks.forEach(blk => {
    if (!blk.isVolumeDevice && blk.isMounted && blk.isExt4)
      mps.push({
        ref: blk,
        mp: blk.mountpoint
      })
  })
  **/

  await Promise
    .map(mps, obj => probeFruitmixAsync(obj.mp).reflect())
    .each((inspection, index) => {
      if (inspection.isFulfilled())
        mps[index].ref.wisnuc = inspection.value() 
      else {
        mps[index].ref.wisnuc = 'ERROR'
      }
    })

  return pretty
}


// GET /storage ? raw=true or wisnuc=true
router.get('/', (req, res) => {

  // raw storage, for debug
  if (req.query.raw === 'true')
    return res.status(200).json(Storage.get(false))

  // pretty storage
  if (req.query.wisnuc === 'true') 
    return decorateStorageAsync().asCallback((err, result) => err
      ? res.status(500).json({ code: err.code, message: err.message })
      : res.status(200).json(result)

  // using nolog because some version of pc client polling this api
  // may be removed in future TODO
  else
    return nolog(res).status(200).json(adapted)

})


/**
  POST /mir/run
  { 
    target: fsUUID 
  }
**/
const isValidRunArgs = body => 
  typeof body === 'object' 
    && body !== null 
    && typeof body.target !== 'string' 
    && !validator.isUUID(body.target)

router.post('/run', (req, res) => 
  !isValidRunArgs(req.body) 
    ? res.status(400).json({ code: 'EINVAL', message: 'invalid arguments' }) 
    : manualBootAsync(req.body, false).asCallback(err => err
      ? res.status(400).json({ code: err.code, message: err.message })
      : res.status(200).json({ message: 'ok' })))

/**
  POST /mir/init
  { 
    target: fsUUID, 
    username: non-empty STRING, 
    password: non-empty STRING, 
    remove: undefined, false or true
  }
**/
const isValidInitArgs = body =>
  typeof body === 'object'
    && body !== null
    && typeof body.target === 'string'
    && validator.isUUID(body.target)
    && typeof body.username === 'string'
    && body.username.length > 0
    && typeof body.password === 'string'
    && body.password.length > 0
    && (body.remove === undefined || typeof body.remove === 'boolean')

router.post('/init', (req, res) => 
  !isValidInitArgs(req.body)
    ? res.status(400).json({ code: 'EINVAL', message: 'invalid arguments' })
    : manualBootAsync(req.body, true).asCallback(err => err
      ? res.status(500).json({ code: err.code, message: err.message })
      : res.status(200).json({ message: 'ok' })

/**
  POST /mir/mkfs
  {
    type: 'btrfs',
    target: ['sda', 'sdb', ...],
    mode: 'single' or 'raid0' or 'raid1'
  }
**/
const isValidMkfsArgs = body => 
  typeof body === 'object'
    && body !== null
    && body.type === 'btrfs'
    && Array.isArray(body.target)
    && body.target.every(item => typeof item === 'string' && item.length > 0)  
    && -1 !== ['single', 'raid0', 'raid1'].indexOf(body.mode)

router.post('/mkfs', (req, res) => 
  !isValidMkfsArgs(req.body)
    ? res.status(400).json({ code: 'EINVAL', message: 'invalid arguments' })
    : mkfsBtrfs(req.body, (err, volume) => err 
      ? res.status(500).json({ code: err.code, err.message })
      : res.status(200).json(volume)) 

module.exports = router


