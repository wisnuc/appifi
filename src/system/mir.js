import path from 'path'
import express from 'express'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import validator from 'validator'
import Debug from 'debug'

// import { storeState} from '../reducers' 

import { mkfsBtrfs } from './mkfs'
import { fakeReboot } from './boot'
import { adaptStorage, initFruitmix, probeFruitmix, probeAllFruitmixes } from './adapter'

const debug = Debug('system:mir')
const router = express.Router()

const runnable = wisnuc => (typeof wisnuc === 'object' && wisnuc !== null && wisnuc.users)
const nolog = (res) => {
  res.nolog = true
  return res 
}

router.get('/', (req, res) => {

  let storage = storeState().storage
  if (!storage)
    return res.status(500).end()

  if (req.query.raw === 'true')
    return res.status(200).json(storage)

  let adapted = adaptStorage(storage)
  if (req.query.wisnuc === 'true') 
    probeAllFruitmixes(adapted, (err, copy) => 
      err ? res.status(500).json({ message: err.message }) :
        res.status(200).json(copy))
  else
    nolog(res).status(200).json(adapted)
})


//
// target: <file system uuid>
//
router.post('/run', (req, res) => {

  debug('run', req.body)

  let bstate = storeState().boot
  if (bstate.state !== 'maintenance')
    return res.status(400).json({ message: '系统未处于维护模式' }) 

  if (typeof req.body !== 'object' || 
    req.body === null || 
    typeof req.body.target !== 'string' ||
    !validator.isUUID(req.body.target))
    return res.status(400).json({ code: 'EINVAL', message: '非法参数' }) 

  let adapted = adaptStorage(storeState().storage)
  let volume = adapted.volumes.find(vol => vol.fileSystemUUID === req.body.target)

  if (!volume) 
    return res.status(400).json({ message: 'volume not found' })
  if (!volume.isMounted)
    return res.status(400).json({ message: 'volume not mounted' })
  if (volume.isMissing)
    return res.status(400).json({ message: 'volume has missing device' })

  probeFruitmix(volume.mountpoint, (err, wisnuc) => {

    debug('probe fruitmix', err || wisnuc)

    if (err) 
      return res.status(500).json({ message: err.message })

    debug('run, wisnuc', wisnuc)

    if (!runnable(wisnuc))
      return res.status(400).json({ message: 'wisnuc not runnable', code: wisnuc.error }) 

    fakeReboot({type: 'btrfs', uuid: req.body.target}, (err, boot) => 
      err ? 
        res.status(500).json({ message: err.mesage }) :
        res.status(200).json({ boot }))
  })
})

//
// target: uuid (file system uuid)
// remove: 'wisnuc' or 'fruitmix' or undefined
//
router.post('/init', (req, res) => {

  debug('init', req.body)

  let bstate = storeState().boot
  if (bstate.state !== 'maintenance')
    return res.status(400).json({ message: '系统未处于维护模式' }) 

  if (typeof req.body !== 'object' ||
    req.body === null ||
    typeof req.body.target !== 'string' ||
    !validator.isUUID(req.body.target) || 
    typeof req.body.username !== 'string' || 
    req.body.username.length === 0 ||
    typeof req.body.password !== 'string' ||
    req.body.password.length === 0 ||
    (req.body.remove !== undefined && req.body.remove !== 'wisnuc' && req.body.remove !== 'fruitmix'))
    return res.status(400).json({ code: 'EINVAL', message: '非法参数' }) 

  let { target, username, password, remove } = req.body

  let adapted = adaptStorage(storeState().storage)
  let filesystems = [
    ...adapted.volumes,
    ...adapted.blocks.filter(blk => blk.isFileSystem && !blk.isVolumeDevice)
  ]

  let fsys = filesystems.find(f => f.fileSystemUUID === target)
  if (!fsys)
    return res.status(400).json({ message: 'file system not found' }) 

  if (!fsys.isBtrfs && !fsys.isExt4)
    return res.status(400).json({ message: 'only btrfs and ext4 is supported' })

  if (fsys.isBtrfs && fsys.isMissing)
    return res.status(400).json({ message: 'btrfs volume has missing device' })

  if (!fsys.isMounted)
    return res.status(400).json({ message: 'failed to mount file system' })

  let mp = fsys.mountpoint

  initFruitmix({mp, username, password, remove }, (err, user) => {
    if (err) {
      console.log(err)
      return res.status(500).json({ message: err.message })
    }
    return res.status(200).json(user)
  })
})

/**
  {
    type: 'btrfs'
    target: ['sda', 'sdb'...], device name
    mode: single, raid0, raid1
  }
  {
    type: 'ext4' or 'ntfs'
    target: 'sda', 'sda1', device name
  }
**/
router.post('/mkfs', (req, res) => {

  debug('mkfs', req.body)

  let bstate = storeState().boot
  if (bstate.state !== 'maintenance')
    return res.status(400).json({ message: '系统未处于维护模式' }) 

  if (typeof req.body !== 'object' || req.body === null ||
    ['btrfs', 'ext4', 'ntfs'].indexOf(req.body.type) === -1)     
    return res.status(400).json({ code: 'EINVAL', message: '非法参数' }) 

  let { type, target, mode } = req.body
  if (type !== 'btrfs') 
    return res.status(400).json({ message: 'not supported yet' }) 

  mkfsBtrfs(target, mode, (err, volume) => {
    if (err) {
      console.log(err)
      return res.status(500).json({ message: err.message })
    }
    return res.status(200).json(volume)
  })
})

export default router


