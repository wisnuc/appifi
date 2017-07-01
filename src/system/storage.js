const Promise = require('bluebird')
const path = require('path')
// const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const mkdirp = require('mkdirp')
// const rimraf = require('rimraf')

const mkdirpAsync = Promise.promisify(mkdirp)
// const rimrafAsync = Promise.promisify(rimraf)

const debug = require('debug')('system:storage')
// const UUID = require('uuid')
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
Returns volume mountpoint. This is where it should mount, not where it is actually mounted.

@param {RawVolume} vol - raw volume object
@returns {string} Absolute path of mountpoint
*/
const volumeMountpoint = vol => `/run/wisnuc/volumes/${vol.uuid}`

/**
Returns block device mountpoint. This is where is should mount, not where it is actually mounted.
@returns {string} Absolute path of mountpoint
*/
const blockMountpoint = blk => `/run/wisnuc/blocks/${blk.name}`

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
Probe raw ports, blocks, volumes, mounts, and swaps
@returns raw storage object without usages
*/
const probeStorage = async () => {
  const result = await Promise.all([
    probePorts(),
    probeBlocks(),
    probeVolumesAsync(),
    probeMountsAsync(),
    probeSwapsAsync()
  ])

  const storage = {
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
const volumeMount = (volume, mounts) =>
  mounts.find(mnt => volume.devices.find(dev => dev.path === mnt.device))

/**
 * Find out the volume the given block device belongs to, return volume or undefined
 */
const blockVolume = (block, volumes) =>
  volumes.find(vol => vol.devices.find(dev => dev.path === block.props.devname))

/**
 * a callback for two mount functions
 */
const stampMountError = (inspection, item) => {
  if (inspection.isFulfilled()) {
    item.mountError = null
  } else if (inspection.isRejected()) {
    // TODO
    console.log('[storage] failed to mount volume or block: ', item)
    item.mountError = inspection.reason().message
  } else {
    // TODO
    console.log('[storage] unexpected inspection which is neither fulfilled or rejected for volume or block: ', item)
    item.mountError = 'neither fulfilled nor rejected'
  }
}

/**
Mount single volume, with opts
*/
const mountVolumeAsync = async (uuid, mountpoint, opts) => {
  await mkdirpAsync(mountpoint)

  const cmd = opts
    ? `mount -t btrfs -o ${opts} UUID=${uuid} ${mountpoint}`
    : `mount -t btrfs UUID=${uuid} ${mountpoint}`

  await child.execAsync(cmd)
}

/**
Mount all volumes not mounted yet.
Volumes with missing devices are mounted with `degrade,ro` option.
*/
const mountVolumesAsync = async (volumes, mounts) => {
  const unmounted = volumes.filter(vol => volumeMount(vol, mounts) === undefined)

  debug('mounting volumes', unmounted)

  return Promise.all(unmounted.map(async (vol) => {
    try {
      mountVolumeAsync(vol.uuid, volumeMountpoint(vol), vol.missing ? 'degraded,ro' : null)
    } catch (e) {
      vol.mountError = e.message
    }
  }))
}

/**
Try to mount all blocks with supported file systems that not mounted yet.
*/
const mountNonVolumesAsync = async (blocks, mounts) => {
  const mountNonUSB = async (blk) => {
    const dir = blockMountpoint(blk)
    await mkdirpAsync(dir)
    await child.execAsync(`mount ${blk.props.devname} ${dir}`)
  }

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

  return Promise
    .map(unmounted, (blk) => {
      if (blk.props.id_bus === 'usb') { return child.execAsync(`udisksctl mount --block-device ${blk.props.devname} --no-user-interaction`).reflect() }
      return mountNonUSB(blk).reflect()
    })
    .each((inspection, index) => {
      stampMountError(inspection, unmounted[index])
    })
}

/**
Probe btrfs volume usages
*/
const probeUsages = async (mounts) => {
  const filtered = mounts.filter(mnt => mnt.fs_type === 'btrfs' &&
    mnt.mountpoint.startsWith('/run/wisnuc/volumes/') && !mnt.mountpoint.endsWith('/graph/btrfs'))
  return Promise.all(filtered.map(mnt => probeUsageAsync(mnt.mountpoint)))
}

/**
 * probe (expect usages), mount, reprobe mount, then probe usages, all result merged
 */
const probeStorageWithUsages = async () => {
  const storage = await probeStorage()

  await mountVolumesAsync(storage.volumes, storage.mounts)
  await mountNonVolumesAsync(storage.blocks, storage.mounts)

  const mounts = await probeMountsAsync()

  await Promise.delay(100)

  const usages = await probeUsages(mounts)
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

// stat props (including hardware info)
// stat parentName
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

// easy job, append idBus
const statBlocksBus = blocks =>
  blocks.forEach((blk) => {
    blk.stats.idBus = blk.props.id_bus
    if (blk.props.id_bus === 'usb') { blk.stats.isUSB = true } else if (blk.props.id_bus === 'ata') { blk.stats.isATA = true } else if (blk.props.id_bus === 'scsi') { blk.stats.isSCSI = true }
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
 * volumes must be stated first.
 */
const statBlocks = ({ blocks, volumes, mounts, swaps }) => {
  blocks.forEach((blk) => {
    blk.stats = {}
  })
  statBlocksStatic(blocks)
  statBlocksBus(blocks)
  statBlocksMountSwap(blocks, volumes, mounts, swaps)

  // stat unformattable reason
  blocks.forEach((blk) => {
    const reason = unformattableReason(blk, blocks)
    if (reason) blk.stats.unformattable = reason
  })
}

// duplicate minimal information
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
      if (mount.mountpoint === '/') { vol.stats.isRootFS = true }
    }
  })

// extract file systems out of storage object
/**
const extractFileSystems = ({ blocks, volumes }) =>
  [...blocks.filter(blk => blk.isFileSystem && !blk.isVolumeDevice),
    ...volumes.filter(vol => vol.isFileSystem)]
**/

const prettyStorage = (storage) => {
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

  Since persistence has no abort method (even if it has one, instant stopping all actions
  can not be guaranteed in nodejs), this may be an issue for testing.

  one way is using different fpath for each test, avoiding race in writing files.

  another way is to nullify persistence in testing, if that feature are not going to be tested.

  this module is not written in JavaScript class and singleton-ized with an object. Instead,
  it is a global object itself, which eliminates the need of another global object as holder.

  But all states are held in one object and initAsync method will refresh them all. This
  enables testability.

**/
/**
module.exports = {

  persistence: null,
  storage: null,

  async refreshAsync() {
    const storage = await probeStorageWithUsages()
    statVolumes(storage.volumes, storage.mounts)
    statBlocks(storage)

    this.storage = storage
    deepFreeze(this.storage)

    if (this.persistence) this.persistence.save(prettyStorage(storage))

    return prettyStorage(this.storage)
  },

  async initAsync(fpath, tmpdir) {
    this.persistence = await createPersistenceAsync(fpath, tmpdir, 500)
    this.storage = null
  },
}
**/

module.exports = new class {
  constructor () {
    /**
    Raw probed storage, for debug purpose
    */
    this.storage = null

    /**

    */
    this.pretty = null
    this.error = null

    /**
    Pending request
    */
    this.pending = []

    /**
    Working request
    @member {function[]} - callbacks
    */
    this.working = []

    this.probe()
  }

  finish () {
    this.working.forEach(cb => cb(this.error, this.pretty))
    this.working = []

    broadcast.emit('StorageUpdate', this.error, this.pretty)

    if (this.pending.length) {
      this.working = this.pending
      this.pending = []
      this.probe()
    }
  }

  probe () {
    probeStorageWithUsages()
      .then((storage) => {
        statVolumes(storage.volumes, storage.mounts)
        statBlocks(storage)

        this.storage = storage
        deepFreeze(this.storage)

        this.pretty = prettyStorage(storage)
        deepFreeze(this.pretty)

        this.error = null
        this.finish()
      })
      .catch((e) => {
        this.error = e
        this.finish()
      })
  }

  refresh (callback) {
    if (this.working.length) {
      this.pending.push(callback)
      return
    }

    this.working = [callback]
    this.probe()
  }
}()
