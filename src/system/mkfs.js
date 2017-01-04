import { refreshStorageAsync } from './storage'

// FIXME !!!
const isWisnucDevice = true

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

/**
 * unmount all blocks contained by target, target may be a volume or 
 */ 
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
    debug(`un-mounting volume ${mvols[i].uuid}`)
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

/**
 *
 */
const mkfsBtrfsAsync = async (target, mode, init) => {

  let blocks, volumes

  debug('mkfsBtrfs', target, mode)

  target = Array.from(new Set(target)).sort()

  await refreshStorageAsync()
  let err = validateBtrfsCandidates(target)
  if (err) throw er

  // dirty !!! FIXME
  let devnames = target.map(name => '/dev/' + name) 
 
  await umountBlocks(target)

  debug(`mkfs.btrfs ${mode}`, devnames)
  await child.execAsync(`mkfs.btrfs -d ${mode} -f ${devnames.join(' ')}`)
  await refreshStorageAsync()

  blocks = storeState().storage.blocks

  let block = blocks.find(blk => blk.name === target[0])

  debug('newly made fs block', block)

  let uuid = block.stats.fileSystemUUID

  volumes = storeState().storage.volumes

  let volume = volumes.find(vol => vol.uuid === uuid)
  let mp = volume.stats.mountpoint

  debug('mkfsBtrfs success', volume)

  await installFruitmixAsync(mp, init) 

  debug('fruitmix installed')  

  return uuid
}

const mkfsBtrfs = (target, mode, init, callback) =>
  mkfsBtrfsAsync(target, mode, init).asCallback(callback)

const mkfsExt4 = async (target, opts) => {

  await refreshStorageAsync() // with stats decoration

  debug('mkfsExt4', target, opts)

  target = Array.from(new Set(target)).sort()

  let err = validateExt4Candidates(target)
  if (err) throw err

  await umountBlocks(target)

  debug('mkfsExt4 success')
}

const mkfsNtfs = async (target, opts) => {

  await refreshStorageAsync() 
  
  debug('mkfsNtfs', target, opts)

  target = Array.from(new Set(target)).sort()
  let err = validateOtherFSCandidates(target)
  if (err) throw err

  await umountBlocks(target)
  
  debug('mkfsNtfs success')
}

