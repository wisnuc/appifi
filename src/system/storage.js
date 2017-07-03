const Promise = require('bluebird')
const path = require('path')
const child = Promise.promisifyAll(require('child_process'))

const mkdirpAsync = Promise.promisify(require('mkdirp'))
const router = require('express').Router()

const debug = require('debug')('system:storage')
const deepFreeze = require('deep-freeze')

const probePortsAsync = require('./storage/probePortsAsync')
const probeBlocksAsync = require('./storage/probeBlocksAsync')
const probeMountsAsync = require('./storage/procMountsAsync')
const probeSwapsAsync = require('./storage/procSwapsAsync')
const probeVolumesAsync = require('./storage/btrfsfishowAsync')
const probeUsageAsync = require('./storage/btrfsusageAsync')

const broadcast = require('../common/broadcast')

/**
Storage module probes all storage devices and annotates extra information, including:

+ ports (ata only for now)
+ blocks, all linux block devices
+ volumes, all btrfs volumes
+ mount, mountpoint, mount error, active swap.
+ formattable, whether this device can be formatted
+ wisnuc station information on devices.


raw data are not defined as type in this document. Final version are defined in detail.

@module Storage
*/


/**
An annotated block device

For linux block device, `id_fs_usage`  indicates a block device contains a file system, 
including special file system.

For regular file system, `idFsUsage` is `filesystem`. 
For linux swap, it is `other`. 
For lvm/md raid, it is `raid`.
For encrypted file system, which usually requires a userspace driver, it is `crypto`.

@typedef {object} Block
@property {string} name
@property {string} [parentName] - when block device is a partition
@property {string} devname
@property {string} path
@property {boolean} removable
@property {number} size in 512 byte block
@property {boolean} [isDisk] - when block device is a physical disk
@property {string} [model] - disk model
@property {string} [serial] - disk serial number
@property {boolean} [isPartitioned] - when disk is partitioned
@property {string} [partitionTableType]
@property {string} [partitionTableUUID]
@property {boolean} [isPartition] - when block device is a partition
@property {boolean} [isExtended] - when block device is an extended partition (DOS)
@property {boolean} [fsUsageDefined] - when block device contains file system
@property {boolean} [idFsUsage] - `filesystem`, `other`, `raid`, or `crypto`.
@property {boolean} [isFileSystem] - is regular file system
@property {boolean} [isVolumeDevice] - btrfs volume device
@property {boolean} [isBtrfs] - btrfs volume device
@property {string} [btrfsVolume] - btrfs volume uuid, the same as file system uuid
@property {string} [btrfsDevice] - btrfs device uuid (sub uuid)
@property {boolean} [isExt4] - ext4 file system
@property {boolean} [isNtfs] - NTFS file system
@property {boolean} [isVfat] - fat16, fat32, and exFat file system
@property {boolean} [isOtherFileSystem] - special file system other than raid or crypto
@property {boolean} [isLinuxSwap] - linux swap file system
@property {boolean} [isRaidFileSystem] - `idFsUsage` is `raid`
@property {boolean} [isCryptoFileSystem] - `idFsUsage` is `crypto`
@property {boolean} [isUnsupportedFsUsage] - unknown usage for kernel
@property {boolean} [isUSB] - usb device
@property {boolean} [isATA] - ata device
@property {boolean} [isSCSI] - scsi device
@property {boolean} [isMounted] - mounted
@property {string} [mountpoint] - mountpoint, when mounted
@property {boolean} [isRootFS] - the file system is root file system
@property {boolean} [isActiveSwap] - the file system is linux swap in use
@property {string} [mountError] - error message, if the block is regular file system and not mounted. 
@property {string} [unformattable] - enum string, unformattable reason
*/



/**
@typedef {object} Storage 
@property {Block[]} blocks
*/

/**
Returns the (raw) mount object for given volume, or undefined
@param {volume} volume
@param {mount[]} mounts
*/
const volumeMount = (volume, mounts) =>
  mounts.find(mnt => volume.devices.find(dev => dev.path === mnt.device))

/**
Returns the (raw) volume the given block device belongs to, or undefined
@param {block} 
*/
const blockVolume = (block, volumes) =>
  volumes.find(vol => vol.devices.find(dev => dev.path === block.props.devname))

/**
Mount all volumes not mounted yet. Volumes with missing devices are mounted with `degrade,ro` option.
@param {volume[]} volumes
@param {mount[]} mounts
*/
const mountVolumesAsync = async (volumes, mounts) => {
  const unmounted = volumes.filter(vol => volumeMount(vol, mounts) === undefined)

  debug('mounting volumes', unmounted)

  return Promise.all(unmounted.map(async vol => {
    try {
      const mountpoint = `/run/wisnuc/volumes/${vol.uuid}`
      await mkdirpAsync(mountpoint)

      const cmd = vol.missing
        ? `mount -t btrfs -o degraded,ro UUID=${vol.uuid} ${mountpoint}`
        : `mount -t btrfs UUID=${vol.uuid} ${mountpoint}`

      await child.execAsync(cmd)
    } catch (e) {
      vol.mountError = e.message
    }
  }))
}

/**
Mount all blocks with supported file systems that not mounted yet.
`ext4`, `ntfs`, and `vfat` file system are supported for now.

For usb device, `udisksctl` is used. `/media/${username}/${uuid or label}`
For non-usb device, `mount` is used. `/run/wisnuc/blocks/${blk.name}`

@param {block[]} blocks
@param {mount[]} mounts
*/
const mountNonVolumesAsync = async (blocks, mounts) => {
  // only for known file system type on standalone disk or partition, whitelist policy
  const unmounted = blocks.filter((blk) => {
    // if blk is disk
    //   blk is fs (and no partition table)
    //     && fs type is (ext4 or ntfs or vfat) && blk is not mounted
    // if block is partition
    //   blk is fs && fs type is (ext4 or ntfs or vfat) && blk is not mounted
    if ((blk.props.devtype === 'disk' && !blk.props.id_part_table_type) 
      || blk.props.devtype === 'partition') {
      if (blk.props.id_fs_usage === 'filesystem' &&
        ['ext4', 'ntfs', 'vfat'].indexOf(blk.props.id_fs_type) !== -1 &&
        !mounts.find(mnt => mnt.device === blk.props.devname)) {
        return true
      }
    }
  })

  debug('mounting blocks', unmounted)

  return Promise.all(unmounted.map(async (blk) => {
    try {
      if (blk.props.id_bus === 'usb') {
        await child.execAsync(`udisksctl mount --block-device ${blk.props.devname} --no-user-interaction`)
      } else {
        const dir = `/run/wisnuc/blocks/${blk.name}`
        await mkdirpAsync(dir)
        await child.execAsync(`mount ${blk.props.devname} ${dir}`)
      }
    } catch (e) {
      blk.mountError = e.message
    }
  }))
}

/**
Probe btrfs volume usages

@param {mount[]} mounts
*/
const probeUsages = async (mounts) => {
  const filtered = mounts.filter(mnt => mnt.fs_type === 'btrfs' &&
    mnt.mountpoint.startsWith('/run/wisnuc/volumes/') && !mnt.mountpoint.endsWith('/graph/btrfs'))
  return Promise.all(filtered.map(mnt => probeUsageAsync(mnt.mountpoint)))
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

/**
Annotate a block device with `idFsUsage` defined

@param {block} blk
*/
const statFsUsageDefined = (blk) => {
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
  } else if (blk.props.id_fs_usage === 'other') {
    blk.stats.isOtherFileSystem = true
    if (blk.props.id_fs_type === 'swap') { // is swap disk
      blk.stats.isLinuxSwap = true
    }
  } else if (blk.props.id_fs_usage === 'raid') {
    blk.stats.isRaidFileSystem = true
  } else if (blk.props.id_fs_usage === 'crypto') {
    blk.stats.isCryptoFileSystem = true
  } else {
    blk.stats.isUnsupportedFsUsage = true
  }
}

/**
Annotate static information for all block devices

@param {block[]} blocks
*/
const statBlocksStatic = blocks =>
  blocks.forEach((blk, idx, arr) => {
    if (blk.props.devtype === 'disk') {
      // start of device is disk
      blk.stats.isDisk = true
      blk.stats.model = blk.props.id_model
      blk.stats.serial = blk.props.id_serial_short

      // id_part_table_type override id_fs_usage, to fix #16
      if (blk.props.id_part_table_type) {
        // is partitioned disk
        blk.stats.isPartitioned = true
        blk.stats.partitionTableType = blk.props.id_part_table_type
        blk.stats.partitionTableUUID = blk.props.id_part_table_uuid
      } else if (blk.props.id_fs_usage) {
        // id_fs_usage defined
        statFsUsageDefined(blk)
      }
    } else if (blk.props.devtype === 'partition') {
      // is partitioned
      // we dont know if the partition is whether formatted or not TODO
      blk.stats.isPartition = true
      if (blk.props.id_fs_usage) {
        statFsUsageDefined(blk)
      } else if (blk.props.id_part_entry_type === '0x5') {
        blk.stats.isExtended = true
      }

      const parent = arr.find(b => b.path === path.dirname(blk.path))
      if (parent) { blk.stats.parentName = parent.name }
    }
  })

/**
Annotate bus information for all block devices

@param {block[]} blocks
*/
const statBlocksBus = blocks =>
  blocks.forEach((blk) => {
    blk.stats.idBus = blk.props.id_bus

    if (blk.props.id_bus === 'usb') {
      blk.stats.isUSB = true
    } else if (blk.props.id_bus === 'ata') {
      blk.stats.isATA = true
    } else if (blk.props.id_bus === 'scsi') {
      blk.stats.isSCSI = true
    }
  })

/**
Annotate mount and swap information for all block devices
`volumes` must be annotated first!
for volume device, information are copied from volume.

@param {block[]} blocks
@param {volume[]} volumes
@param {mount[]} mounts
@param {swap[]} swaps
*/
const statBlocksMountSwap = (blocks, volumes, mounts, swaps) =>
  blocks.forEach((blk) => {
    if (blk.stats.isVolumeDevice) {
      const volume = blockVolume(blk, volumes)
      if (volume && volume.stats.isMounted) {
        blk.stats.isMounted = true
        blk.stats.mountpoint = volume.stats.mountpoint
        if (volume.stats.isRootFS) { blk.stats.isRootFS = true }
      }
    } else if (blk.stats.isFileSystem) {
      // it doesn't matter if this is a disk or a partition, as long as it has
      // id_fs_usage === filesystem
      const mount = mounts.find(mnt => mnt.device === blk.props.devname)
      if (mount) {
        blk.stats.isMounted = true
        blk.stats.mountpoint = mount.mountpoint
        if (mount.mountpoint === '/') { blk.stats.isRootFS = true }
      } else if (typeof blk.mountError === 'string') {
        blk.stats.mountError = blk.mountError
      }
    } else if (blk.stats.isLinuxSwap) {
      const swap = swaps.find(swap => swap.filename === blk.props.devname)
      if (swap) blk.stats.isActiveSwap = true
    }
  })

/**
`unformattable` is a concept applicable only for blocks.

This function returns a string or a joined string. Valid values include:
+ `RootFS`, the block is or contains root file system
+ `ActiveSwap`, the block is or contains active swap file system
+ `Extended`, the block is an extended partition

If a block is a partitioned disk and contains several unformattable partition, 
the reason is a joined string delimited by `:`, deduplicated. Example:
`ActiveSwap:RootFS`

@param {RawBlock} block - block device
@param {RawBlock[]} blocks - all block devices
@returns {string} A string indicating unformattable reason, or undefined
*/
const unformattableReason = (block, blocks) => {
  // check partitioned disk first, then either standalone fs or partition
  if (block.stats.isDisk && block.stats.isPartitioned) {
    const reasons = blocks
      .filter(blk => blk.stats.parentName === block.name && !blk.stats.isExtended)
      .map(blk => unformattableReason(blk, blocks))
      .filter(r => !!r)
    if (reasons.length) {
      return Array
        .from(new Set(reasons))
        .sort()
        .join(':')
    } else {
      return undefined
    }
  } else if (block.stats.isRootFS) {
    return 'RootFS'
  } else if (block.stats.isActiveSwap) {
    return 'ActiveSwap'
  } else if (block.stats.isExtended) {
    return 'Extended'
  } else {
    return undefined
  }
}

/**
Annotate all information on all block devices

@param {storage} storage
*/
const statBlocks = storage => {
  const { blocks, volumes, mounts, swaps } = storage
  blocks.forEach(blk => (blk.stats = {}))
  statBlocksStatic(blocks)
  statBlocksBus(blocks)
  statBlocksMountSwap(blocks, volumes, mounts, swaps)

  // stat unformattable reason
  blocks.forEach((blk) => {
    const reason = unformattableReason(blk, blocks)
    if (reason) blk.stats.unformattable = reason
  })
}

/**
Annotate all information on all volumes

@param {storage} storage
*/
const statVolumes = storage => {
  const {volumes, mounts} = storage
  volumes.forEach((vol) => {
    // volume must keep file system info since it may be used as file system object
    vol.stats = {
      isVolume: true,
      isMissing: vol.missing,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: vol.uuid
    }

    const mount = volumeMount(vol, mounts)
    if (mount) {
      vol.stats.isMounted = true
      vol.stats.mountpoint = mount.mountpoint
      if (mount.mountpoint === '/') vol.stats.isRootFS = true
    }
  })
}


/**
Reformat storage object. Extract useful information and merge with annotations.

@param {storage} storage
*/
const reformatStorage = storage => {
  // adapt ports
  const ports = storage.ports.map(port => ({
    path: port.path,
    subsystem: port.props.subsystem
  }))

  // add name, devname, path, removable and size, merged into stats
  const blocks = storage.blocks.map(blk => Object.assign({
    name: blk.name,
    devname: blk.props.devname,
    path: blk.path,
    removable: blk.sysfsProps[0].attrs.removable === '1',
    size: parseInt(blk.sysfsProps[0].attrs.size, 10)
  }, blk.stats))

  // process volumes
  const volumes = storage.volumes.map((vol) => {
    // find usage for this volume
    const usage = storage.usages.find(usg => usg.mountpoint === vol.stats.mountpoint)

    // this is possible if volume mount failed, which is observed on at least one machine
    if (!usage) {
      const mapped = Object.assign({}, vol, vol.stats) // without usage
      delete mapped.stats

      mapped.devices = vol.devices.map(dev => ({
        name: path.basename(dev.path), // tricky
        path: dev.path,
        id: dev.id,
        used: dev.used
      }))

      return mapped
    }

    // copy level 1 props
    const copy = {
      overall: usage.overall,
      system: usage.system,
      metadata: usage.metadata,
      data: usage.data,
      unallocated: usage.unallocated
    }

    // copy volume object, merge stats and usage
    const mapped = Object.assign({}, vol, vol.stats, { usage: copy })
    delete mapped.stats

    // copy level 2 (usage for each volume device) into devices
    mapped.devices = vol.devices.map((dev) => {
      const devUsage = usage.devices.find(ud => ud.name === dev.path)
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

/**
A full storage probe, including the following steps:

1. probe raw ports, blocks, volumes, mounts, and swaps
2. mount all file systems. If there is error, error information is annotated on file system.
  1. mount all btrfs volumes. Volumes with missing devices are mounted with `degraded,ro` option.
  2. mount all block devices, including both standalone file system and partitions.
    1. usb disk or partitions are mounted using `udisksctl` command.
    2. non-usb disk or partitions are mounted using `mount` command.
3. probe mounts again
4. probe btrfs usage
5. merge all results into storage object (raw)
6. annotate all volumes and blocks.
7. reformat
8. fruitmix are probed on all healthy volumes.

This final version is freezed and returned.

@return {Storage} the final fully annotated storage object
*/
const probeAsync = async () => {
  // first probe
  const arr = await Promise.all([
    probePortsAsync(),
    probeBlocksAsync(),
    probeVolumesAsync(),
    probeMountsAsync(),
    probeSwapsAsync()
  ])

  const s0 = {
    ports: arr[0],
    blocks: arr[1],
    volumes: arr[2],
    mounts: arr[3],
    swaps: arr[4]
  }

  debug('probe storage without usages', JSON.stringify(s0, null, '  '))

  // mount all file systems
  await mountVolumesAsync(s0.volumes, s0.mounts)
  await mountNonVolumesAsync(s0.blocks, s0.mounts)

  // probe mount again
  const mounts = await probeMountsAsync()

  await Promise.delay(100)

  // probe usages
  const usages = await probeUsages(mounts)
  // merge to s1
  const s1 = Object.assign({}, s0, { mounts, usages })

  // annotate
  statVolumes(s1)
  statBlocks(s1)

  // reformat (prettify)
  const storage = reformatStorage(s1)

  // probe fruitmix
  await Promise.all(storage.volumes
    .filter(v => v.isMounted && !v.isMissing)
    .map(async v => {
      try {
        // v.users = await user.detectFruitmix(v.mountpoint) TODO
      } catch (e) {
        v.users = e.code || e.message
      }
    }))

  // freeze all
  deepFreeze(storage)
  return storage
}

class Synchronized {
  constructor () {
    this.pending = []
    this.working = []
  }

  finish (err, data) {
    this.working.forEach(cb => cb(err, data))
    if (this.pending.length) {
      this.working = this.pending
      this.pending = []
      this.run()
    }
  }

  request (callback = () => {}) {
    if (this.working.length === 0) {
      this.working = [callback]
      this.run()
    } else {
      this.pending.push(callback)
    }
  }

  async requestAsync () {
    return new Promise((resolve, reject) => {
      this.request((err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
}

module.exports = new class extends Synchronized {
  constructor () {
    super()
    this.request()
  }

  finish (err, data) {
    super.finish(err, data)
    broadcast.emit('StorageUpdate', err, data)
  }

  run () {
    probeAsync()
      .then(data => this.finish(null, data))
      .catch(e => this.finish(e))
  }
}()

router.get('/', (req, res, next) => {
})

router.post('/volumes', (req, res, next) => {
})


