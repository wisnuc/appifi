import path from 'path'
import express from 'express'
import validator from 'validator'

import { storeState, storeDispatch } from '../appifi/lib/reducers' 

import Debug from 'debug'
const debug = Debug('system:mir')

const router = express.Router()

router.get('/', (req, res) => {

  let storage = storeState().storage
  if (!storage)
    return res.status(500).end()

  let ports = storage.ports.map(port => ({
    path: port.path,
    subsystem: port.props.subsystem
  }))

  let blocks = storage.blocks.map(blk => Object.assign({
    name: blk.name,
    devname: blk.props.devname,
    path: blk.path,
    removable: blk.sysfsProps[0].attrs.removable === "1",
    size: parseInt(blk.sysfsProps[0].attrs.size)
  }, blk.stats))

  let usages = storage.usages

  let volumes = storage.volumes.map(vol => { 

    let usage = usages.find(usg => usg.mountpoint === vol.stats.mountpoint)
    if (usage) delete usage.mountpoint

    let mapped = Object.assign({}, vol, vol.stats, { usage })
    delete mapped.stats

    mapped.devices = vol.devices.map(dev => ({
      name: path.basename(dev.path),
      devname: dev.path,
      id: dev.id,
      size: dev.size,
      used: dev.used 
    }))
    
    return mapped
  })

  let ret = Object.assign({}, storage, { ports, blocks, volumes }) 
  delete ret.mounts
  delete ret.swaps
  delete ret.usages

  debug('mapped storage with wisnuc detection', ret)

  res.status(200).json(ret)
})

/**

  target: ['sda'],  // if mkfs is NOT provided, which means starts from existing disk
                    // target must be single file system
                    // this can be either 1 block name or 1 uuid representing a btrfs volume
                    // for wisnuc device, 1 btrfs volume uuid is required
                    // for non-wisnuc device, 1 block name is also OK but the filesystem must be either ext4, or ntfs

                    // if mkfs IS provided, which means creating new filesystem
                    // this must 1 to N non-duplicated block names
                    // for wisnuc device, mkfs.type must be 'btrfs' and all blocks must be ATA disk
                    // for non-wisnuc device
                    //  if mkfs.type is btrfs, all blocks must be disk, either ATA/SCSI or USB
                    //  if mkfs.type is ext4, only one block is allowed, can be either ATA/SCSI or USB disk, or partition
                    //  if mkfs.type is ntfs, only one block is allowed, can be either ATA/SCSI or USB disk, or partition

  mkfs: {           
    type: 'btrfs',
    opts: raid mode  
  }

  init: {           // this must be provided if mkfs is provided
    username:       // if mkfs is NOT provided (starting from existing disk), if init is provided, the /wisnuc folder will be erased and re-created.
    password:
  }

  mkfs.btrfs: 0 -> n disks, with raid mode
  mkfs.ext4: 1 disk or 1 partition
  mkfs.ntfs

  install / reinstall

  ///////

  valid combination

  target only (which means run)

  target + init (which means overwrite and run)

  target + mkfs + init (which means mkfs + init + run)

**/

const isSingleUUID = (target) => 
  Array.isArray(target) && target.length === 1 && 
    typeof target[0] === 'string' && validator.isUUID(target[0])

const isSingleName = (target) =>
  Array.isArray(target) && target.length === 1 &&
    typeof target[0] === 'string'

// return null for valid
// return string for error
const validateInit = (init) => {

  if (init === undefined) return null

  if (init instanceof Object === false) return 'init is not an object' 

  if (init.username === undefined) return 'init.username must be provided'
  if (typeof init.username !== 'string') return 'init.username must be a string'
  if (init.username.length === 0) return 'init.username must not be an empty string'

  // sanitize ???
  
  if (init.password === undefined) return 'init.password must be provided'  
  if (typeof init.password !== 'string') return 'init.password must be a string'
  if (init.password.length === 0) return 'init.password must not be an empty string'

  return null
}

const R = (res) => (code, error, reason) => {

  let obj 
  if (error instanceof Error) {
    obj = {
      message: error.message,
      code: error.code
    }
  }
  else if (typeof error === 'string')
    obj = { message: error }
  else 
    obj = { message: 'none' }

  if (reason) obj.reason = reason
  return res.status(code).json(obj)
}

router.post('/', (req, res) => {

  const startMountpoint = (mp) => {
    fs.stat(path.join(mp, 'wisnuc/fruitmix'), (err, stats) => {
      if (err) return R(res)(500, err)
      if (!stats.isDirectory()) 
        return R(res)(405, `wisnuc/fruitmix on target block or volume is not a directory`)

      // start fruitmix TODO
      R(res)(200, `fruitmix started on volume ${volume.uuid}`)
    })
  }

  const installMountpoint = (mp) => {
   
    let fruit = path.join(mp, 'wisnuc/fruitmix') 
    rimraf(fruit, err => {
      if (err) return R(res)(500, err)
      mkdirp(fruit, err => {
        if (err) return R(res)(500, err)
        
        // start fruitmix
        R(res)(200, `fruitmix started on`)
      })
    })
  }

  const runWisnuc = (mp, init) => {
        
  }

  const mir = req.body 
  const storage = storeState().storage

  // first validation
  if (mir instanceof Object === false) 
    return R(res)(400, `invalid parameters`) 

  if (storage instanceof Object === false)
    return R(res)(500, `storage not an object`)

  let { target, mkfs, init } = mir
  let { blocks, volumes } = storage
 
  // target must be array 
  if (!Array.isArray(target)) return res.status(500).end()

  if (target && mkfs === undefined) { // install or run

    let err = validateInit(init) 
    if (err) return R(res)(400, err)

    // target must be single UUID or block containing supported fs
    // target must contains wisnuc 
    if (!isSingleName(target)) 
      return R(res)(400, `To install or run fruitmix, target must be single block name or volume uuid`)

    if (isSingleUUID(target)) {

      let uuid = target[0]
      let volume = volumes.find(vol => vol.uuid === uuid)
      debug(`volume`, volume)

      if (!volume) return R(res)(404, `volume ${uuid} not found`)
      if (volume.missing) return R(res)(405, `volume ${volume.uuid} has missing disk`)
      if (!volume.stats.isMounted || !volume.stats.mountpoint) 
        return R(res)(500, `volume is not mounted, or mountpoint is not correctly parsed`)

      let mp = volume.stats.mountpoint

      if (init) {
        debug(`installing AND running wisnuc on volume ${uuid} mounted @ ${mp}`) 
      }
      else {
        debug(`running wisnuc on volume ${uuid} mounted @ ${mp}`) 
      }
    }
    else {
      
      let name = target[0] 
      let block = blocks.find(blk => blk.name === name) 
      if (!block) return R(res)(404, `block device ${name} not found`)

      if (block.stats.isVolume) {
        return R(res)(405, `block device ${name} is a volume device, please use volume uuid as argument`)
      }
      else if (block.stats.isDisk) { // non-volume disk
        if (block.isPartitioned) 
          return R(res)(405, `block device ${name} is a partitioned disk`)
        if (!block.stats.isFileSystem) 
          return R(res)(405, `block device ${name} contains no file system`)
        if (!block.stats.isNtfs && !block.stats.isExt4) 
          return R(res)(405, `block device ${name} contains no ntfs or ext4`)
      }
      else if (block.stats.isPartition) {
        if (!block.stats.isNtfs && !block.stats.isExt4)
          return R(res)(405, `block device ${name} contains no ntfs or ext4`)
      }
      else {
        return R(res)(500, `unexpected situation, contact developers`)
      }

      if (!block.stats.isMounted || !block.stats.mountpoint)
        return R(res)(500, `block device is not mounted, or mountpoint is not correctly parsed`)

      let mp = block.stats.mountpoint
      return startMountpoint(mp)
    }
  }
  else if (target && init && mkfs) {

    let { blocks } = storage

    // if mkfs type is btrfs
    //   target must be 1 - n disk
    // if mkfs type is ntfs or ext4
    //   target must be single disk or partition
    if (mkfs.type === 'btrfs') {

      for (let i = 0; i < target.length; i++) {

        let name = target[i]
        let block = blocks.find(blk => blk.name === name) 
        if (!block) return R(res)(404, `block device ${name} not found`)
        if (!block.isDisk) return R(res)(405, `block device ${name} is not a disk`)

        let reason = formattable(block)  
        if (reason) return R(res)(405, `block device ${name} cannot be formatted`, reason)

      }   

      makeBtrfs(target, mode, err => {

        refreshStorage().asCallback(() => {})
        if (err)
          return R(res)(500, err)
        else
          return R(res)(200, 'success')
      })            
    }
    else if (mkfs.type === 'ntfs' || mkfs.type === 'ext4') {
      return R(res)(500, `not implemented yet`)      
    }
    else {
      return R(res)(405, `unsupported mkfs type`)
    }
  }
  else {
    // not supported combination
    return res.status(400).json({
      message: 'invalid combination of target, mkfs, and init'
    })
  }
})

export default router


