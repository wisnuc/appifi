import path from 'path'
import mkdirp from 'mkdirp'
import { fs, child, mkdirpAsync, rimrafAsync } from '../common/async'
import Debug from 'debug'
import UUID from 'node-uuid'

// import { storeDispatch } from '../reducers'

import udevInfoAsync from './udevInfoAsync'
import probeMountsAsync from './procMountsAsync'
import probeSwapsAsync from './procSwapsAsync'
import probeVolumesAsync from './btrfsfishowAsync'
import probeUsageAsync from './btrfsusageAsync'

import Persistent from '../common/persistent'

const debug = Debug('system:storage')

const volumeMountpoint = vol => '/run/wisnuc/volumes/' + vol.uuid
const blockMountpoint = blk => '/run/wisnuc/blocks/' + blk.name

// probe ports
const probePorts = async () => udevInfoAsync((
  await child.execAsync('find /sys/class/ata_port -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length))

// probe blocks
const probeBlocks = async () => udevInfoAsync((
  await child.execAsync('find /sys/class/block -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length)
    .filter(l => l.startsWith('/sys/class/block/sd')))

// probe ports, blocks, volumes, mounts, and swaps
const probeStorage = async () => {

  let result = await Promise.all([
    probePorts(), probeBlocks(), probeVolumesAsync(), probeMountsAsync(), probeSwapsAsync()
  ])

  let storage = {
    ports: result[0],
    blocks: result[1],
    volumes: result[2],
    mounts: result[3],
    swaps: result[4]
  }

  debug('probe storage without usages', storage)
  return storage
}

/**
 * Find out the mount for given volume, return mount object or undefined
 */
const volumeMount = (volume, mounts) => mounts.find(mnt => volume.devices.find(dev => dev.path === mnt.device))

/**
 * Find out the volume the given block device belongs to, return volume or undefined
 */
const blockVolume = (block, volumes) => volumes.find(vol => vol.devices.find(dev => dev.path === block.props.devname))

/**
 * a callback for two mount functions
 */
const stampMountError = (inspection, item) => {
  if (inspection.isFulfilled())
    item.mountError = null
  else if (inspection.isRejected()) {
    console.log('[storage] failed to mount volume or block: ', item)
    item.mountError = inspection.reason().message
  }
  else {
    console.log('[storage] unexpected inspection which is neither fulfilled or rejected for volume or block: ', item)
    item.mountError = 'neither fulfilled nor rejected'
  }
}

/**
 * mount single volume, with opts
 */
const mountVolumeAsync = async (uuid, mountpoint, opts) => {

  await mkdirpAsync(mountpoint)

  let cmd = opts ? 
    `mount -t btrfs -o ${opts} UUID=${uuid} ${mountpoint}` : 
    `mount -t btrfs UUID=${uuid} ${mountpoint}`

  await child.execAsync(cmd) 
}

/**
 * try to mount all volumes not mounted yet
 */
const mountVolumesAsync = async (volumes, mounts) => {

  let unmounted = volumes.filter(vol => volumeMount(vol, mounts) === undefined)

  console.log('[storage] mounting volumes', unmounted)

  return Promise
    .map(unmounted, vol => mountVolumeAsync(vol.uuid, volumeMountpoint(vol), vol.missing ? 'degraded,ro' : null).reflect())
    .each((inspection, index) => {
      stampMountError(inspection, unmounted[index]) 
    })
}

/**
 * try to mount all blocks with supported file systems that not mounted yet
 */
const mountNonVolumesAsync = async (blocks, mounts) => {

  const mountNonUSB = async (blk) => {

    const dir = blockMountpoint(blk)
    await mkdirpAsync(dir)
    await child.execAsync(`mount ${blk.props.devname} ${dir}`)
  }

  // only for known file system type on standalone disk or partition, whitelist policy
  let unmounted = blocks.filter(blk => {

    // if blk is disk
    //   blk is fs (and no partition table) && fs type is (ext4 or ntfs or vfat) && blk is not mounted
    // if block is partition
    //   blk is fs && fs type is (ext4 or ntfs or vfat) && blk is not mounted
    if ((blk.props.devtype === 'disk' && !blk.props.id_part_table_type) || blk.props.devtype === 'partition') {
      if (blk.props.id_fs_usage === 'filesystem' &&
        ['ext4', 'ntfs', 'vfat'].indexOf(blk.props.id_fs_type) !== -1 &&
        !mounts.find(mnt => mnt.device === blk.props.devname)) {
        return true
      }
    }
  })

  console.log('[storage] mounting blocks', unmounted)

  return Promise
    .map(unmounted, blk => {
      if (blk.props.id_bus === 'usb')
        return child.execAsync(`udisksctl mount --block-device ${blk.props.devname} --no-user-interaction`).reflect()
      else
        return mountNonUSB(blk).reflect()
    })
    .each((inspection, index) => {
      stampMountError(inspection, unmounted[index])
    })
}

/**
 * probe btrfs volume usages
 */
const probeUsages = async mounts => {

  let filtered = mounts.filter(mnt => mnt.fs_type === 'btrfs' && 
    mnt.mountpoint.startsWith('/run/wisnuc/volumes/') && !mnt.mountpoint.endsWith('/graph/btrfs'))
  return await Promise.all(filtered.map(mnt => probeUsageAsync(mnt.mountpoint)))
}

/**
 * probe (expect usages), mount, reprobe mount, then probe usages, all result merged
 */ 
const probeStorageWithUsages = async () => {

  let storage = await probeStorage()

  await mountVolumesAsync(storage.volumes, storage.mounts),
  await mountNonVolumesAsync(storage.blocks, storage.mounts) 

  let mounts = await probeMountsAsync()

  await Promise.delay(100)

  let usages = await probeUsages(mounts)
  return Object.assign({}, storage, { mounts, usages })
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

const statFsUsageDefined = blk => {

  blk.stats.fsUsageDefined = true
  blk.stats.idFsUsage = blk.props.id_fs_usage
  blk.stats.fileSystemType = blk.props.id_fs_type
  blk.stats.fileSystemUUID = blk.props.id_fs_uuid

  if (blk.props.id_fs_usage === 'filesystem') { // used as file system

    blk.stats.isFileSystem = true
    switch (blk.props.id_fs_type) {
    case 'btrfs':
      blk.stats.isVolumeDevice = true
      blk.stats.isBtrfs = true
      blk.stats.btrfsVolume = blk.props.id_fs_uuid
      blk.stats.btrfsDevice = blk.props.id_fs_uuid_sub
      break
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
  }
  else if (blk.props.id_fs_usage === 'other') {

    blk.stats.isOtherFileSystem = true

    if (blk.props.id_fs_type === 'swap') { // is swap disk
      blk.stats.fileSystemtype = 'swap'
      blk.stats.isLinuxSwap = true
      blk.stats.fileSystemUUID = blk.props.id_fs_uuid
    }
  }
  else {
    // raid is something here
    blk.stats.isUnsupportedFsUsage = true
  }
}


// stat props (including hardware info)
// stat parentName
const statBlocksStatic = blocks => 
  blocks.forEach((blk, idx, arr) => {
    if (blk.props.devtype === 'disk') { // start of device is disk

      blk.stats.isDisk = true
      blk.stats.model = blk.props.id_model
      blk.stats.serial = blk.props.id_serial_short

      // id_part_table_type override id_fs_usage, to fix #16
      if (blk.props.id_part_table_type) { // is partitioned disk
        blk.stats.isPartitioned = true
        blk.stats.partitionTableType = blk.props.id_part_table_type
        blk.stats.partitionTableUUID = blk.props.id_part_table_uuid
      }
      else if (blk.props.id_fs_usage) // id_fs_usage defined
        statFsUsageDefined(blk)
    }
    else if (blk.props.devtype === 'partition') { // is partitioned

      // we dont know if the partition is whether formatted or not TODO
      blk.stats.isPartition = true
      if (blk.props.id_fs_usage) 
        statFsUsageDefined(blk)
      else if (blk.props.id_part_entry_type === '0x5')
        blk.stats.isExtended = true

      let parent = arr.find(b => b.path === path.dirname(blk.path))
      if (parent) 
        blk.stats.parentName = parent.name
    }
  })

// easy job, append idBus
const statBlocksBus = blocks => 
  blocks.forEach(blk => {
    blk.stats.idBus = blk.props.id_bus
    if (blk.props.id_bus === 'usb')
      blk.stats.isUSB = true
    else if (blk.props.id_bus === 'ata')
      blk.stats.isATA = true
    else if (blk.props.id_bus === 'scsi')
      blk.stats.isSCSI = true
  })

/**
 * stat blocks mount and swap, requires volumes stated first!
 *
 * isMounted, mountpoint, isRootFs, isActiveSwap
 *
 * for volume device, such info is copied from corresponding volume
 */
const statBlocksMountSwap = (blocks, volumes, mounts, swaps) =>
  blocks.forEach(blk => {

    if (blk.stats.isVolumeDevice) {
      let volume = blockVolume(blk, volumes)
      if (volume && volume.stats.isMounted) {
        blk.stats.isMounted = true
        blk.stats.mountpoint = volume.stats.mountpoint
        if (volume.stats.isRootFS)
          blk.stats.isRootFS = true
      }
    }
    else if (blk.stats.isFileSystem) {
      // it doesn't matter if this is a disk or a partition, as long as it has 
      // id_fs_usage === filesystem
      let mount = mounts.find(mnt => mnt.device === blk.props.devname)
      if (mount) {
        blk.stats.isMounted = true
        blk.stats.mountpoint = mount.mountpoint
        if (mount.mountpoint === '/')
          blk.stats.isRootFS = true
      } 
    }
    else if (blk.stats.isLinuxSwap) {
      let swap = swaps.find(swap => swap.filename === blk.props.devname)
      if (swap) blk.stats.isActiveSwap = true
    }
  })

//
// formattable is a concept applicable only for blocks, either disk or partition (including non-formatted)
// extended partition is not formattable
// for partitioned disk
//   containing partitions that either isRootFS or isActiveSwap is unformattable
//   if (extended partition is excluded, this can be dont in recursive way.
// for partition or volume device
//   isExtended, or isRootFS, or isActiveSwap is unformattable
//
// the following code is not used, but it is a good reference for checking logic
const unformattable = (block, blocks) => 
  (block.stats.isDisk && blocks.stats.isPartitioned) ? 
    blocks.filter(blk => blk.stats.parentName === block.name && !blk.stats.isExtended)
      .some(blk => unformattable(blk)) : 
      (block.stats.isRootFS || block.stats.isActiveSwap) // for volume device, isRootFS is copied from volume

// exactly the same logic with above
// returns non-empty array or single object containing name and reason
const unformattableReason = (block, blocks) => {
  
  if (block.stats.isDisk && block.stats.isPartitioned) {
    let reasons = blocks
      .filter(blk => blk.stats.parentName === block.name && !blk.stats.isExtended)
      .map(blk => unformattableReason(blk, blocks))
      .filter(r => !!r)
    if (reasons.length) return reasons // return array
  }
  else if (block.stats.isRootFS || block.stats.isActiveSwap) {
    // return object
    return {
      name: block.name,
      reason: block.stats.isRootFs ? 'isRootFS' : 'isActiveSwap'
    }
  }
  return null
}


/**
 * volumes must be stated first.
 */
const statBlocks = ({blocks, volumes, mounts, swaps}) => {

  blocks.forEach(blk => blk.stats = {})
  statBlocksStatic(blocks) 
  statBlocksBus(blocks)
  statBlocksMountSwap(blocks, volumes, mounts, swaps)
 
  // stat unformattable reason 
  blocks.forEach(blk => {
    let reason = unformattableReason(blk, blocks)
    if (reason) blk.stats.unformattable = reason
  })
}


// duplicate minimal information
const statVolumes = (volumes, mounts) => 
  volumes.forEach(vol => {

    // volume must keep file system info since it may be used as file system object
    vol.stats = { 
      isVolume: true,
      isMissing: vol.missing,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: vol.uuid
    }

    let mount = volumeMount(vol, mounts)
    if (mount) {
      vol.stats.isMounted = true
      vol.stats.mountpoint = mount.mountpoint
      if (mount.mountpoint === '/')
        vol.stats.isRootFS = true
    }
  })

let firstLog = 0

// TODO

mkdirp.sync('/run/wisnuc/')
const ipc = new Persistent('/run/wisnuc/storage', '/run/wisnuc', 1000)

const refreshStorageAsync = async () => {

  let storage = await probeStorageWithUsages()

  // stat volumes first
  statVolumes(storage.volumes, storage.mounts)
  statBlocks(storage) 

  if (!firstLog++) console.log('[storage] first probe', storage)
  storeDispatch({
    type: 'STORAGE_UPDATE',
    data: storage
  })

  ipc.save(storage) 

  debug('storage refreshed: ', storage)
  return storage
}

const prettyStorage = storage => {

  // adapt ports
  let ports = storage.ports.map(port => ({
    path: port.path,
    subsystem: port.props.subsystem
  }))

  // add name, devname, path, removable and size, merged into stats
  let blocks 
  blocks = storage.blocks.map(blk => Object.assign({
    name: blk.name,
    devname: blk.props.devname,
    path: blk.path,
    removable: blk.sysfsProps[0].attrs.removable === "1",
    size: parseInt(blk.sysfsProps[0].attrs.size)
  }, blk.stats))

  // process volumes
  let volumes = storage.volumes.map(vol => { 

    // find usage for this volume
    let usage = storage.usages.find(usg => usg.mountpoint === vol.stats.mountpoint)

    // this is possible if volume mount failed, which is observed on at least one machine
    if (!usage) {

      let mapped = Object.assign({}, vol, vol.stats) // without usage
      delete mapped.stats

      mapped.devices = vol.devices.map(dev => {
        return {
          name: path.basename(dev.path), // tricky
          path: dev.path,
          id: dev.id,
          used: dev.used,
        }
      })

      return mapped
    }

    // copy level 1 props
    let copy = {
      overall: usage.overall,
      system: usage.system,
      metadata: usage.metadata,
      data: usage.data,
      unallocated: usage.unallocated
    }

    // copy volume object, merge stats and usage
    let mapped = Object.assign({}, vol, vol.stats, { usage: copy })
    delete mapped.stats

    // copy level 2 (usage for each volume device) into devices
    mapped.devices = vol.devices.map(dev => {

      let devUsage = usage.devices.find(ud => ud.name === dev.path)
      return {
        name: path.basename(dev.path), // tricky
        path: dev.path,
        id: dev.id,
        used: dev.used,
        size: devUsage.size,
        unallocated: devUsage.unallocated,
        system: devUsage.system,
        metadata: devUsage.metadata,
        data: devUsage.data
      }
    })
    
    return mapped
  })

  return { ports, blocks, volumes }
}

class Storage {

  constructor(persistent) {

    // first is only used for printing storage once at startup
    this.first = 0

    this.persistent = persistent
    this.storage = null
  }

  get(pretty) {
    if (!this.storage) return null
    return prettyStorage(this.storage) 
  }

  async refreshAsync(pretty) {

    let storage = await probeStorageWithUsages() 
    statVolumes(storage.volumes, storage.mounts)
    statBlocks(storage)

    if (!this.first++) console.log('[storage] first probe', storage)

    this.storage = storage
    if (this.persistent) 
      this.persistent.save(this.pretty())
  }
} 

const createStorageAsync = async (fpath, tmpdir) => {

  let persistent = await createPersistentAsync(fpath, tmpdir, 500)
  return new Storage(persistent)
}

// export { refreshStorageAsync }
module.exports = createStorageAsync


