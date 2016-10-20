import path from 'path'
import child from 'child_process'

import Debug from 'debug'
const debug = Debug('system:storage')

import { toLines } from './utils'
import { storeState, storeDispatch } from '../lib/reducers'
import { probeDaemon } from '../lib/docker'

const udevInfo = require('./udevInfoAsync')
const probeMounts = require('./procMountsAsync')
const probeSwaps = require('./procSwapsAsync')
const probeVolumes = require('./btrfsfishowAsync')
const probeUsage = require('./btrfsusageAsync')
import { createUdevMonitor } from '../../system/udevMonitor'

function info(text) {
  console.log(`[storage] ${text}`)
}

class InvalidError extends Error {

  constructor(message) {
    super(message)
    this.message = message
    this.name = 'InvalidError'
  }
}

class OperationFailError extends Error {

  constructor(message) {
    super(message)
    this.message = message
    this.name = 'OperationFailError'
  }
}

async function portsPaths() {
  return new Promise((resolve, reject) => 
    child.exec('find /sys/class/ata_port -type l', (err, stdout) => // stderr not used
      err ? reject(err) : resolve(toLines(stdout)))
  )
}

async function probePorts() {
  let paths = await portsPaths()
  return udevInfo(paths)
}

async function blockPaths() {
  return new Promise((resolve, reject) =>
    child.exec('find /sys/class/block -type l', (err, stdout) => // stderr not used
      err ? reject(err) : resolve(toLines(stdout))))
}

async function probeBlocks() {
  let paths = await blockPaths()
  paths = paths.filter(p => p.startsWith('/sys/class/block/sd'))
  return udevInfo(paths)
}

// return mount object if given volume is mounted
const volumeMount = (volume, mounts) => 
  mounts.find((mnt) => volume.devices.find((dev) => dev.path === mnt.device))

const blockVolume = (block, volumes) =>
  volumes.find((vol) => vol.devices.find((dev) => dev.path === block.props.devname))

function blockMount(block, volumes, mounts) {

  let volume = blockVolume(block, volumes)
  return (volume) ? volumeMount(volume, mounts) :
    mounts.find((mnt) => mnt.device === block.props.devname)
}

// this function returns partitions of a disk
// block: must be a disk type block object
const blockPartitions = (block, blocks) =>
  blocks.filter(blk => blk.props.devtype === 'partition' &&
    path.dirname(blk.props.devpath) === block.props.devpath)

async function probeStorage() {

  let result = await Promise.all([probePorts(), probeBlocks(), probeVolumes(), probeMounts(), probeSwaps()])
  return {
    ports: result[0],
    blocks: result[1],
    volumes: result[2],
    mounts: result[3],
    swaps: result[4]
  }
}

async function execAnyway(cmd) {

  return new Promise((resolve) => // never reject
    child.exec(cmd, (err, stdout, stderr) => {
      resolve({cmd, err, stdout, stderr})
    })
  )
}

async function mountVolumeAnyway(uuid, mountpoint, opts) {

  await execAnyway(`mkdir -p ${mountpoint}`)
  if (opts)
    execAnyway(`mount -t btrfs -o {opts} UUID=${uuid} ${mountpoint}`)
  else
    execAnyway(`mount -t btrfs UUID=${uuid} ${mountpoint}`)
}

function uuidToMountpoint(uuid) {
  return '/run/wisnuc/volumes/' + uuid
}

async function mountVolumesAnyway(volumes, mounts) {
  
  let unmounted = volumes.filter(vol => volumeMount(vol, mounts) === undefined)
  let tasks = unmounted.map(vol => mountVolumeAnyway(vol.uuid, uuidToMountpoint(vol.uuid), vol.missing ? 'degraded,ro' : null))
  await Promise.all(tasks)
}

async function probeUsages(mounts) {

  let filtered = mounts.filter(mnt => mnt.fs_type === 'btrfs' && mnt.mountpoint.startsWith('/run/wisnuc/volumes/') && !mnt.mountpoint.endsWith('/graph/btrfs'))
  return await Promise.all(filtered.map(mnt => probeUsage(mnt.mountpoint)))
}

async function probeStorageWithUsages() {

  let storage = await probeStorage()
  await mountVolumesAnyway(storage.volumes, storage.mounts)
  let mounts = await probeMounts()
  await Promise.delay(100)
  let usages = await probeUsages(mounts)
  return Object.assign({}, storage, {mounts, usages})
}

// a block obj may be:
// 
// 1 isDisk
//   1.1 isFileSystem
//     1.1.1 isBtrfsDevice
//   1.2 isPartitioned
//     partitionTableType
// 2 isPartition
//   2.1 isExtended
//     2.1.1 (isExtended=false) fileSystemType 
//   2.2 parent
// 3 isMounted
// 4 isRootFS (for partition, is rootfs partition, for disk && btrfs device, is rootfs volume)
// 5 isSwap 
const statBlocks = (storage) => {

  let { blocks, volumes, mounts, swaps } = storage  

  blocks.forEach(blk => blk.stats = {})

  blocks.forEach((blk, idx, arr) => {

    if (blk.props.devtype === 'disk') {
      blk.stats.isDisk = true

      if (blk.props.id_fs_usage === 'filesystem') {
        blk.stats.isFileSystem = true

        if (blk.props.id_fs_type === 'btrfs') {
          blk.stats.isBtrfs = true
        }
      }
      else if (blk.props.id_part_table_type) {
        blk.stats.isPartitioned = true
        blk.stats.partitionTableType = blk.props.id_part_table_type
        blk.stats.partitionTableUUID = blk.props.id_part_table_uuid
      }
    }
    else if (blk.props.devtype === 'partition') {

      // we dont know if the partition is whether formatted or not TODO

      blk.stats.isPartition = true
      if (blk.props.id_part_entry_type === '0x5') {
        blk.stats.isExtended = true
      } 
      else if (
        blk.props.id_part_entry_type === '0x83' ||
        blk.props.id_part_entry_type === '0x7' ||
        blk.props.id_part_entry_type === '0xb' 
      ) {
        if (blk.props.id_fs_usage === 'filesystem') {
          blk.stats.isFileSystem = true
          blk.stats.fileSystemType = blk.props.id_fs_type
        }
      }
      else if (blk.props.id_part_entry_type === '0x82') {
        blk.stats.isLinuxSwap = true
      }

      let parent = arr.find(b => b.path === path.dirname(blk.path))
      if (parent) 
        blk.stats.parentName = parent.name
    }

    if (blk.props.id_bus === 'usb')
      blk.stats.isUSB = true
    else if (blk.props.id_bus === 'ata')
      blk.stats.isATA = true
    else if (blk.props.id_bus === 'scsi')
      blk.stats.isSCSI = true
  })

  blocks.forEach(blk => {

    if (blk.stats.isDisk && blk.stats.isFileSystem && blk.stats.isBtrfs) {
      
      let volume = blockVolume(blk, volumes)            
      let mount = volumeMount(volume, mounts)
      if (mount) {
        blk.stats.isMounted = true
        blk.stats.mountpoint = mount.mountpoint
        
        if (mount.mountpoint === '/')
          blk.stats.isRootFS = true
      }
    }
    else if (blk.stats.isPartition) {

      if (blk.stats.isLinuxSwap) {
        if (swaps.find(swap => swap.filename === blk.props.devname))
          blk.stats.isActiveSwap = true

        return
      }

      let mount = mounts.find(mnt => mnt.device === blk.props.devname) 
      if (mount) {
        blk.stats.isMounted = true
        blk.stats.mountpoint = mount.mountpoint
      }
    }
  })
}

async function refreshStorage() {

  let obj = await probeStorageWithUsages()

  statBlocks(obj) 
  debug('stat blocks', obj.blocks.map(blk => Object.assign({}, { name: blk.name}, blk.stats)))

  storeDispatch({
    type: 'STORAGE_UPDATE',
    data: obj
  })

  // debug('storage refreshed:', JSON.stringify(obj, null, '  '))
  debug('storage refreshed: ', obj)
}


/*
 *  if disk not ata fail
 *  if disk belongs to docker volume, fail (user must delete docker volume first)
 *  if disk belongs to non-docker volume, and the volume is rootfs, fail
 *  if disk belongs to rootfs, fail
 * 
 *  umount volumes containing disk, if fail, fail
 *  umount non volume disks, if fail, fail
 *  
 *  mkfs.btrfs, if fail, fail
 *  
 */

/*
 *
 * block object creating btrfs volume rules:
 * 
 * (assuming system is not running)
 * 
 * FORCE_NON_REMOVABLE (may include emmc)
 * FORCE_ATA_SCSI (id_bus =/= usb)
 * NO_ACTIVE_SWAP
 * NO_ROOTFS (including rootfs partition as well as rootfs volume)
 *
 *  
 */
async function createVolume(blknames, opts) {
 
  info('createVolume')
  info(`blknames: ${blknames.join(',')}`)
  
  let { mode } = opts
  if (mode === undefined) mode = 'single'
  if (mode !== 'single' && mode !== 'raid0' && mode !== 'raid1') return new Error('invalid mode, only single, raid0, raid1 are supported')
  debug('mode:', mode)

  if (!blknames.length) throw new InvalidError('device names empty')
  debug('blknames:', blknames)

  // undupe
  blknames = blknames.filter((blkname, index, self) => index === self.indexOf(blkname))

  // probe storage
  let storage = await probeStorage()
  let daemon = await probeDaemon()

  if (storage.blocks === null) return
  if (storage.blocks.length === 0) return

  // validate
  blknamesValidation(blknames, storage.blocks, storage.volumes, storage.mounts, storage.swaps, daemon)

  // find mounted mountpoints
  let mps = blknamesMounted(blknames, storage.blocks, storage.volumes, storage.mounts)

  info(`blknames mounted: ${mps.join(' ')}, un-mounting`)

  // umount mounted
  await Promise.all(mps.map(mp => new Promise((resolve, reject) => {
    child.exec(`umount ${mp}`, (err, stdout, stderr) => 
      err ? reject(err) : resolve(stdout))
  })))

  info('unmount mounted blknames successfully')

  let stdout = await new Promise((resolve, reject) => {
    child.exec(`mkfs.btrfs -d ${mode} -f ${blknames.join(' ')}`, (err, stdout, stderr) => {
      err ? reject(err) : resolve(stdout)
    })   
  })

  info('mkfs.btrfs successfully')

  storage = await probeStorageWithUsages()
  return storage.volumes.find(vol => 
    (vol.devices.length === blknames.length) &&
      vol.devices.every(dev => blknames.find(bn => bn === dev.path)))  
 
  /////////////////////////////////////////////////////////////////////////////

  function blknamesValidation(blknames, blocks, volumes, mounts, swaps, daemon) {

    debug('blknames validation begin')

    blknames.forEach(blkname => {

      // find corresponding block (object)
      let block = blocks.find(blk => blk.props.devname === blkname)

      // must exists
      if (!block) throw new InvalidError(blkname + ' not found')

      // must be disk (partition is not allowed)
      if (block.props.devtype !== 'disk') throw new InvalidError(blkname + ' is not a disk')

      // must be ata or scsi, usb is not allowed
      if (block.props.id_bus !== 'ata' && block.props.id_bus !== 'scsi') throw new InvalidError(blkname + ' is not ata disk')

      // check if the block belongs to a volume
      let volume = blockVolume(block, volumes)
      if (volume) {

        debug(`block ${block.name} is in volume ${volume.uuid}`)

        if (daemon.running && daemon.volume === volume.uuid) throw new InvalidError(`${blkname} is a device of running app engine volume, stop app engine before proceeding`)
        let mnt = volumeMount(volume, mounts)
        if (mnt && mnt.mountpoint === '/') throw new InvalidError(`${blkname} is a device of system volume`) // not tested TODO

      }
      else {                      

        debug(`block ${block.name} is not in any volume`)

        let parts = blockPartitions(block, blocks)

        debug(`block ${block.name} contains partitions:`, parts.map(p => p.name))

        parts.forEach(part => {
          let mnt = blockMount(part, volumes, mounts)
          if (mnt && mnt.mountpoint === '/')  throw new InvalidError(`${blkname} contains root partition ${part.devname}`) // not tested TODO
          if (swaps.find(swap => swap.filename === part.devname)) throw new InvalidError(`${blkname} contains swap partition ${part.devname}`) // not tested TODO
        })

        debug(`block ${block.name} contains neither system root nor swap partition`)
      }
    })    

    debug('blknames validation end')
  }

  function blknamesMounted(blknames, blocks, volumes, mounts, swaps) {

    let mountpoints = []
    blknames.forEach((blkname) => {

      let block = blocks.find((blk) => blk.props.devname === blkname)
      let volume = blockVolume(block, volumes)
      if (volume) {
        let mnt = volumeMount(volume, mounts)
        if (mnt) mountpoints.push(mnt.mountpoint)
      }
      else {                      
        let parts = blockPartitions(block, blocks)
        parts.forEach(part => {
          let mnt = blockMount(part, volumes, mounts)
          if (mnt) mountpoints.push(mnt.mountpoint)
        })
      }
    })    
    return mountpoints.filter((mp, pos, self) => self.indexOf(mp) === pos) 
  }
}

async function testOperation() {

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('test operation timeout (deliberately)')
      resolve('hello')
    }, 3000)
  })
}

async function mkfsBtrfsOperation(arg) {

  debug('mkfsBtrfsOperation')

  let opts = { mode: arg.mode }  
  let blknames = arg.blknames
  await createVolume(blknames, opts)
  await refreshStorage()
  return {}
}

async function operation(req) {

  let f, args 
  if (req && req.operation) { 

    info(`operation: ${req.operation}`)

    args = (req.args && Array.isArray(req.args)) ? req.args : [] 
    switch (req.operation) {
    case 'test':
      f = testOperation
      break
    case 'mkfs_btrfs':
      f = mkfsBtrfsOperation
      break
    default:
      info(`operation: ${req.operation} is not implemented`)
      break 
    }    
  }

  if (f) await f(...args)    
  return { errno: 0 }
}

const udevMon = createUdevMonitor()
udevMon.on('events', events => {

  debug('udev events', events)

  let add = false
  let remove = false
  
  events.forEach(evt => {
    if (evt.action === 'add') add = true
    if (evt.action === 'remove') remove = true
  })

  refreshStorage()
    .then(() => {

      let storage = storeState().storage
      let count = 0

      storage.blocks.forEach(blk => {

        let stats = blk.stats
        
        if (stats.isUSB && !stats.isMounted && stats.isPartition && stats.isFileSystem) {
          if (stats.fileSystemType === 'vfat' || 
            stats.fileSystemType === 'ext4' || 
            stats.fileSystemType === 'ntfs') {
         
            debug(`mounting ${blk.props.devname}`, stats)

            ++count
            child.exec(`udisksctl mount --block-device ${blk.props.devname} --no-user-interaction`, err => {
              if (!--count) {
               
                debug(`refresh again`) 
                refreshStorage()
                  .then(() => {
                    debug(`refresh done`) 
                  }) 
                  .catch(e => {
                  })
              }
            })
          }
        }
      })
    })
    .catch(e => {})
})

export default {

  init: () => {
    /** one-shot initialization **/
    refreshStorage()
      .then(r => { 
        info('initialized successfully')
      })
      .catch(e => {
        info(`ERROR: init fails, errno: ${e.errno}, ${e.message}`)
      }) 
  },

  operation: (req, callback) => 
    operation(req)
      .then(r => callback(null, r))
      .catch(e => callback(e)),
}

export {
  mkfsBtrfsOperation
}
