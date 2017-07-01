const Promise = require('bluebird')
const path = require('path')
const child = Promise.promisifyAll(require('child_process'))

const mkdirpAsync = Promise.promisify(require('mkdirp'))

const debug = require('debug')('system:storage')
const deepFreeze = require('deep-freeze')

const udevInfoAsync = require('./storage/udevInfoAsync')
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
+ formattable, whether this device can be formatted
+ wisnuc station information on devices.

A full probe including the following steps:

1. probe raw ports, blocks, volumes, mounts, and swaps
2. mount all file systems. If there is error, error information is annotated on file system.
  1. mount all btrfs volumes. Volumes with missing devices are mounted with `degraded,ro` option.
  2. mount all block devices, including both standalone file system and partitions.
    1. usb disk or partitions are mounted using `udisksctl` command.
    2. non-usb disk or partitions are mounted using `mount` command.
3. probe mounts again
4. probe btrfs usage
5. merge all results into a single storage object (raw)
6. annotate all volumes and blocks, if blocks is unformmatble, the reason is annotated.
7. extract a pretty version
8. all file systems are extracted
9. btrfs volumes are probed for wisnuc installation status.

This final version is stored as storage. It is freezed.

raw data are not defined as type in this document. Final version are defined in detail.

@module Storage
*/

/**
Probe ports
@returns raw ports
*/
const probePorts = async () => udevInfoAsync((
  await child.execAsync('find /sys/class/ata_port -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length))

/**
Probe blocks
@returns raw blocks
*/
const probeBlocks = async () => udevInfoAsync((
  await child.execAsync('find /sys/class/block -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length)
    .filter(l => l.startsWith('/sys/class/block/sd')))

/**
Find out the mount for given volume, return mount object or undefined
*/
const volumeMount = (volume, mounts) =>
  mounts.find(mnt => volume.devices.find(dev => dev.path === mnt.device))

/**
Find out the volume the given block device belongs to, return volume or undefined
*/
const blockVolume = (block, volumes) =>
  volumes.find(vol => vol.devices.find(dev => dev.path === block.props.devname))

/**
Mount all volumes not mounted yet.
Volumes with missing devices are mounted with `degrade,ro` option.
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
Try to mount all blocks with supported file systems that not mounted yet.
*/
const mountNonVolumesAsync = async (blocks, mounts) => {
  // only for known file system type on standalone disk or partition, whitelist policy
  const unmounted = blocks.filter((blk) => {
    // if blk is disk
    //   blk is fs (and no partition table)
    //     && fs type is (ext4 or ntfs or vfat) && blk is not mounted
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
stat props (including hardware info)
stat parentName
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
annotate bus
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
 * stat blocks mount and swap, requires volumes stated first!
 *
 * isMounted, mountpoint, isRootFs, isActiveSwap
 *
 * for volume device, such info is copied from corresponding volume
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
      }
    } else if (blk.stats.isLinuxSwap) {
      const swap = swaps.find(swap => swap.filename === blk.props.devname)
      if (swap) blk.stats.isActiveSwap = true
    }
  })

//
// formattable is a concept applicable only for blocks,
// either disk or partition (including non-formatted)
// extended partition is not formattable
// for partitioned disk
//   containing partitions that either isRootFS or isActiveSwap is unformattable
//   if (extended partition is excluded, this can be dont in recursive way.
// for partition or volume device
//   isExtended, or isRootFS, or isActiveSwap is unformattable
//
// the following code is not used, but it is a good reference for checking logic
const unformattable = (block, blocks) =>
  (block.stats.isDisk && blocks.stats.isPartitioned)
    ? blocks
        .filter(blk => blk.stats.parentName === block.name && !blk.stats.isExtended)
        .some(blk => unformattable(blk))
    // for volume device, isRootFS is copied from volume
    : (block.stats.isRootFS || block.stats.isActiveSwap)

// exactly the same logic with above
// returns non-empty array or single object containing name and reason
const unformattableReason = (block, blocks) => {
  if (block.stats.isDisk && block.stats.isPartitioned) {
    const reasons = blocks
      .filter(blk => blk.stats.parentName === block.name && !blk.stats.isExtended)
      .map(blk => unformattableReason(blk, blocks))
      .filter(r => !!r)
    if (reasons.length) return reasons // return array
  } else if (block.stats.isRootFS || block.stats.isActiveSwap) {
    // return object
    return {
      name: block.name,
      reason: block.stats.isRootFS ? 'isRootFS' : 'isActiveSwap'
    }
  }
  return null
}

/**
format blocks
*/
const statBlocks = ({ blocks, volumes, mounts, swaps }) => {
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
format volumes
*/
const statVolumes = (volumes, mounts) =>
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

/**
Format storage
*/
const formatStorage = storage => {
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

*/
const probeAsync = async () => {
  // first probe
  const arr = await Promise.all([
    probePorts(),
    probeBlocks(),
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

  debug('probe storage without usages', s0)

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
  statVolumes(s1.volumes, s1.mounts)
  statBlocks(s1)

  // format (pretty)
  const storage = formatStorage(s1)

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
