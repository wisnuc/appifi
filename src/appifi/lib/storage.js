import path from 'path'
import child from 'child_process'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'

// TODO
Promise.promisifyAll(child)
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

import Debug from 'debug'
const debug = Debug('system:storage')

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

const probePorts = async () => udevInfo((
  await child.execAsync('find /sys/class/ata_port -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length))

const probeBlocks = async () => udevInfo((
  await child.execAsync('find /sys/class/block -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length)
    .filter(l => l.startsWith('/sys/class/block/sd')))

const probeStorage = async () => {

  let result = await Promise.all([
    probePorts(), probeBlocks(), probeVolumes(), probeMounts(), probeSwaps()
  ])

  let storage = {
    ports: result[0],
    blocks: result[1],
    volumes: result[2],
    mounts: result[3],
    swaps: result[4]
  }

  debug('first-round storage probe', storage)
  return storage
}

// return mount object if given volume is mounted
const volumeMount = (volume, mounts) => 
  mounts.find((mnt) => volume.devices.find((dev) => dev.path === mnt.device))

// return volume object if given block (disk) is a volume deice
const blockVolume = (block, volumes) =>
  volumes.find((vol) => vol.devices.find((dev) => dev.path === block.props.devname))

// return mount object either block is a partition/disk or a volume
const blockMount = (block, volumes, mounts) => {

  let volume = blockVolume(block, volumes)
  return (volume) ? volumeMount(volume, mounts) :
    mounts.find((mnt) => mnt.device === block.props.devname)
}

// this function returns partitions of a disk
// block: must be a disk type block object
const blockPartitions = (block, blocks) =>
  blocks.filter(blk => blk.props.devtype === 'partition' &&
    path.dirname(blk.props.devpath) === block.props.devpath)

const mountVolumeAsync = async (uuid, mountpoint, opts) => {

  await mkdirpAsync(mountpoint)
  let cmd = opts ? 
    `mount -t btrfs -o {opts} UUID=${uuid} ${mountpoint}` :
    `mount -t btrfs UUID=${uuid} ${mountpoint}`

  await child.execAsync(cmd) 
}

const volumeMountpoint = (vol) => '/run/wisnuc/volumes/' + vol.uuid
const blockMountpoint = (blk) => '/run/wisnuc/blocks/' + blk.name

const mountVolumesAsync = async (volumes, mounts) => {

  let unmounted = volumes.filter(vol => volumeMount(vol, mounts) === undefined)
  
  debug('mounting volumes', unmounted)

  return Promise.map(unmounted, vol => 
    mountVolumeAsync(vol.uuid, volumeMountpoint(vol), vol.missing ? 'degraded,ro' : null))
}

const mountNonVolumesAsync = async (blocks, mounts) => {

  const mountNonUSB = async (blk) => {
    const dir = blockMountpoint(blk)
    await mkdirpAsync(dir)
    await child.execAsync(`mount ${blk.props.devname} ${dir}`)
  }

  let unmounted = blocks.filter(blk => {

    // if blk is disk
    //   blk is fs && fs type is (ext4 or ntfs or vfat) && blk is not mounted
    // if block is partition
    //   blk is fs && fs type is (ext4 or ntfs or vfat) && blk is not mounted
   
    if (blk.props.devtype === 'disk' || blk.props.devtype === 'partition') {
      if (blk.props.id_fs_usage === 'filesystem') {
        let type = blk.props.id_fs_type
        if (type === 'ext4' || type === 'ntfs' || type === 'vfat') {
          if (!mounts.find(mnt => mnt.device === blk.props.devname))
            return true
        }
      }
    }
  })

  debug('mounting blocks', unmounted)

  return Promise.map(unmounted, blk => {
    if (blk.props.id_bus === 'usb')
      return child.execAsync(`udisksctl mount --block-device ${blk.props.devname} --no-user-interaction`)
    else
      return mountNonUSB(blk) 
  })
}

async function probeUsages(mounts) {

  let filtered = mounts.filter(mnt => mnt.fs_type === 'btrfs' && mnt.mountpoint.startsWith('/run/wisnuc/volumes/') && !mnt.mountpoint.endsWith('/graph/btrfs'))
  return await Promise.all(filtered.map(mnt => probeUsage(mnt.mountpoint)))
}

async function probeStorageWithUsages() {

  let storage = await probeStorage()

  await mountVolumesAsync(storage.volumes, storage.mounts),
  await mountNonVolumesAsync(storage.blocks, storage.mounts) 

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

      if (blk.props.id_fs_usage) { // id_fs_usage defined, no undefined case found yet
        blk.stats.isUsedAsFileSystem = true

        if (blk.props.id_fs_usage === 'filesystem') { // used as file system

          blk.stats.isFileSystem = true
          blk.stats.fileSystemType = blk.props.id_fs_type

          if (blk.props.id_fs_type === 'btrfs') { // is btrfs (volume device)
            blk.stats.isVolume = true
            blk.stats.isBtrfs = true
            blk.stats.btrfsVolume = blk.props.id_fs_uuid
            blk.stats.btrfsDevice = blk.props.id_fs_uuid_sub
          }
          else {

            switch (type) {
            case 'ext4':
              blk.stats.isExt4 = true
              break
            case 'ntfs':
              blk.stats.isNtfs = true
              break
            case 'vfat':
              blk.stats.isVfat = true
              break
            default:
              break
            } 

            blk.stats.fileSystemUUID = blk.props.id_fs_uuid
          }
        }
        else if (blk.props.id_part_table_type) { // is partitioned disk

          blk.stats.isPartitioned = true
          blk.stats.partitionTableType = blk.props.id_part_table_type
          blk.stats.partitionTableUUID = blk.props.id_part_table_uuid

        }
      } // end of used as file system
      else if (blk.props.id_fs_usage === 'other') {

        blk.stats.isOtherFileSystem = true
        if (blk.props.id_fs_type === 'swap') { // is swap disk
          blk.stats.fileSystemtype = 'swap'
          blk.stats.isLinuxSwap = true
          blk.stats.fileSystemUUID = blk.props.id_fs_uuid
        }
      } // end of used as other
      else {
        blk.stats.isUnsupportedFileSystem = true
      }
    } // end of 'device is disk'
    else if (blk.props.devtype === 'partition') { // is partitioned

      // we dont know if the partition is whether formatted or not TODO

      blk.stats.isPartition = true
      if (blk.props.id_part_entry_type === '0x5') {
        blk.stats.isExtended = true
      } 
      else if (blk.props.id_part_entry_type === '0x82') {
        blk.stats.isLinuxSwap = true
      }
      else if (blk.props.id_fs_usage === 'filesystem') { // partition as file system

        blk.stats.isFilesystem = true
        let type = blk.stats.fileSystemType = blk.props.id_fs_type
       
        switch (type) {
        case 'ext4':
          blk.stats.isExt4 = true
          break
        case 'ntfs':
          blk.stats.isNtfs = true
          break
        case 'vfat':
          blk.stats.isVfat = true
          break
        default:
          break
        } 

        blk.stats.fileSystemUUID = blk.props.id_fs_uuid        
      }

      let parent = arr.find(b => b.path === path.dirname(blk.path))
      if (parent) 
        blk.stats.parentName = parent.name
    }

    // stats bus
    if (blk.props.id_bus === 'usb')
      blk.stats.isUSB = true
    else if (blk.props.id_bus === 'ata')
      blk.stats.isATA = true
    else if (blk.props.id_bus === 'scsi')
      blk.stats.isSCSI = true
  })

  // stats mount
  blocks.forEach(blk => {

    if (blk.stats.isDisk) {
      if (blk.stats.isFileSystem) {
      
        if (blk.stats.isBtrfs) {
          let volume = blockVolume(blk, volumes)            
          let mount = volumeMount(volume, mounts)
          if (mount) {
            blk.stats.isMounted = true
            blk.stats.mountpoint = mount.mountpoint
            
            if (mount.mountpoint === '/')
              blk.stats.isRootFS = true
          }
        }
        else if (blk.stats.isExt4 || blk.stats.isNtfs || blk.stats.isVfat) {
          let mount = mounts.find(mnt => mnt.device === blk.props.devname) 
          if (mount) {
            blk.stats.isMounted = true
            blk.stats.mountpoint = mount.mountpoint
            if (mount.mountpoint === '/')
              blk.stats.isRootFS = true
          }
        }
      }
      else if (blk.stats.isOtherFileSystem) {
        if (blk.stats.isLinuxSwap) {
          if (swaps.find(swap => swap.filename === blk.props.devname))
            blk.stats.isActiveSwap = true
        }
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

        if (mount.mountpoint === '/')
          blk.stats.isRootFS = true
      }
    }
  })
}

const statVolumes = (storage) => {
  
  let { volumes, mounts } = storage

  volumes.forEach(vol => {
    
    vol.stats = {}
    let mount = volumeMount(vol, mounts)
    if (mount) {
      vol.stats.isMounted = true
      vol.stats.mountpoint = mount.mountpoint
    }
  })
}

async function refreshStorage() {

  let obj = await probeStorageWithUsages()

  statBlocks(obj) 
  statVolumes(obj)

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

// check if a block is formattable
// return null if YES
// return object representing unformattable reason
//   type: rootfs, swap, extended
//   volume: block is a disk and in a volume (uuid)
//   disk: block is a disk containing standalone file system (devname)
//   partition: block is either a partition or a partitioned disk, containing a partition
//              with given type of problem. 
const formattable = (block) => {

  if (block.stats.isDisk) {

    // check mount point and active swap
    if (block.stats.isVolume) {

      // if is volume device, volume must not be rootfs
      let uuid = block.stats.btrfsVolume
      let volume = volumes.find(vol => vol.uuid === uuid)
      if (volume.stats.isMounted && volume.stats.mountpoint === '/') 
        return { type: 'rootfs', volume: uuid }
    } 
    else if (block.stats.isFileSystem) {

      // if is standalone file system, file system must not be rootfs or active swap
      if (block.stats.isMounted && block.stats.mountpoint === '/') 
        return { type: 'rootfs', disk: block.name }
      if (block.stats.isActiveSwap)
        return { type: 'swap', disk: block.name}
    }
    else if (block.stats.isPartitioned) {

      // if is partitioned, containing no partition that is either rootfs or swap
      let children = blocks.filter(blk => 
        blk.stats.isPartition && !blk.stats.parentName === block.name)

      for (let i = 0; i < children.length; i++) {
        if (children[i].isMounted && children[i].mountpoint === '/')
          return { type: 'rootfs', partition: children[i].name }

        if (children[i].isActiveSwap)
          return { type: 'swap', partition: children[i].name }
      }
    }
  }
  else if (block.stats.isPartition) {

    if (block.stats.isExtended)
      return { type: 'extended', partition: block.name }  

    if (block.stats.isMounted && block.stats.mountpoint === '/')
      return { type: 'rootfs', partition: block.name }

    if (block.stats.isActiveSwap)
      return { type: 'swap', partition: block.name }
  }

  return null
}

// must exists
// must be disk
// must be ata or scsi, if opts set
// --- volume, volume must not be rootfs
// --- disk / filesystem, fs must not be rootfs
// --- disk / partitioned, no partition is rootfs or active swap
const validateBtrfsCandidates = (target) => {

  let error = (text, code, reason) => 
    Object.assign(new Error(text), reason ? ({ code, reason }) : ({ code }))

  let { blocks, volumes } = storeState().storage

  for (let i = 0; i < target.length; i++) {

    let block = blocks.find(blk => blk.name === target[i])

    // non-exist
    if (!block) 
      return error(`block ${target[i]} does not exist`, 'ENOENT')

    // not a disk
    if (!block.stats.isDisk)
      return error(`block ${target[i]} is not a disk`, 'ENOTDISK')

    // for wisnuc device, disk must be ATA or SCSI
    if (isWisnucDevice && !block.stats.isATA && !block.stats.isSCSI) // NOTATAORSCSI
      return error(`block ${target[i]} is not an ata or scsi disk`, 'ENOTATAORSCSI')
  
    let fmt = formattable(block)  
    if (fmt) 
      return error(`formatting block device ${target[i]} is forbidden`, 'EFORBIDDEN', fmt)
  }

  return null
}

// single block, can be either disk or partition
const validateOtherFSCandidates = (target) => {

  let { blocks, volumes } = storeState().storage

  if (target.length !== 1) 
    return error(`must be exactly one block device`, 'EINVAL')

  let block = blocks.find(blk => blk.name === target[0])   
  if (!block)
    return error(`block ${target[0]} does not exist`, 'ENOENT')

  let reason = formattable(block) 
  if (reason)
    return error(`formatting block device ${block.name} is forbidden`, 'EFORBIDDEN', reason)

  return null
}

const umount = (mountpoint, callback) => 
  child.exec(`umount ${mountpoint}`, err => callback(err)) 

const umountAsync = Promise.promisify(umount)

const umountBlocks = async (target) => {

  let { blocks, volumes } = storeState().storage

  let blks = target.map(name => blocks.find(blk => blk.name === name))

  // if it is volume device
  let uuids = blks.filter(blk => blk.stats.isMounted)   // filter mounted
                .filter(blk => blk.stats.isVolume)      // filter volume devices
                .map(blk => blk.stats.btrfsVolume)      // map to uuid (may dup)

  let mvols = Array.from(new Set(uuids)).sort()         // dedup
                .map(uuid => volumes.find(vol =>        // map to volume
                  vol.uuid === uuid))

  // if it is partitioned disk (not necessarily mounted)
  let mparts = blks.filter(blk => blk.stats.isDisk && blk.stats.isPartitioned)
                .reduce((prev, curr) => prev.concat(blocks.filter(blk => 
                  blk.stats.parentName === curr.name)) , [])
                .filter(blk => blk.stats.isMounted)

  // the left should be partition or disk with standalone fs
  let mblks = blks.filter(blk => blk.stats.isMounted)   // filter mounted 
                .filter(blk => blk.stats.isPartition || // is partition
                  (blk.isDisk && blk.isFileSystem && !blk.isVolume)) // is non-volume filesystem disk

  // for mounted volumes, normal umount
  // for mounted blocks (with fs)
  //  umount usb by udisksctl
  //  umount non-usb by normal umount
  let i
  for (i = 0; i < mvols.length; i++) {
    debug(`un-mounting volume ${mvol[i].uuid}`)
    await umountAsync(mvols[i].stats.mountpoint)
  }

  for (i = 0; i < mparts.length; i++) {
    debug(`un-mounting partition ${mparts[i].name}`)
    await umountAsync(mparts[i].stats.mountpoint)
  }

  for (i = 0; i < mblks.length; i++) {
    debug(`un-mounting block ${mblk[i].name}`)
    await umountAsync(mblks[i].stats.mountpoint)
  }
}

const makeBtrfs = (target, mode, callback) => {

  umountBlocks(target).asCallback(err => {
    if (err) return callback(err)

    let storage = storeState().storage
    let blocks = storage.blocks 

    let devices = target
                    .map(name => blocks.find(blk => blk.name === name))
                    .map(blk => blk.name)

    let cmd = `mkfs.btrfs -d ${mode} -f ${devices.join(' ')}`
    child.exec(cmd, (err, stdout, stderr) => {
      debug('make btrfs', cmd, stdout, stderr)
      callback(err)
    })   
  })
}

const makeExt4 = (target, callback) => {

  unmountBlocks(target).asCallback(err => {
    if (err) return callback(err)

    // child.exec(`mkfs.btrfs 
  })
}

const mkfsBtrfs = async (target, opts) => {

  await refreshStorage() // with stats decoration
  
  let { blocks, } = storeState().storage
 
  debug('mkfsBtrfs', target, opts)

  target = Array.from(new Set(target)).sort()

  let err = validateBtrfsCandidates(target)
  if (err) throw err
 
  await umountBlocks(target)

  debug('mkfsBtrfs success')
}

const mkfsExt4 = async (target, opts) => {

  await refreshStorage() // with stats decoration

  debug('mkfsExt4', target, opts)

  target = Array.from(new Set(target)).sort()

  let err = validateExt4Candidates(target)
  if (err) throw err

  await umountBlocks(target)

  debug('mkfsExt4 success')
}

const mkfsNtfs = async (target, opts) => {

  await refreshStorage() 
  
  debug('mkfsNtfs', target, opts)

  target = Array.from(new Set(target)).sort()
  let err = validateOtherFSCandidates(target)
  if (err) throw err

  await umountBlocks(target)
  
  debug('mkfsNtfs success')
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
        let fsMountable = (stats) => (stats.isFileSystem && !stats.isVolume) 
        
        if (stats.isUSB && !stats.isMounted && fsMountable(stats)) {
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
