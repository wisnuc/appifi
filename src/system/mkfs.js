const child = require('child_process')
const debug = require('debug')('system:mkfs')
const Storage = require('./storage')

const umount = (mountpoint, callback) => child.exec(`umount ${mountpoint}`, err => callback(err)) 
const umountAsync = Promise.promisify(umount)

/**
 * unmount all blocks contained by target, target may be 
 * a volume device (disk), or standalone fs disk or partition.
 * eg. sdb, sdb1
 */ 
const umountBlocks = async (storage, target) => {

  debug('unmount blocks, storage, target', storage, target)

  let {blocks, volumes } = storage

  let blks = target.map(name => blocks.find(blk => blk.name === name))

  // if it is volume device
  let uuids = blks.filter(blk => blk.isMounted)   // filter mounted
                .filter(blk => blk.isVolumeDevice)// filter volume devices
                .map(blk => blk.btrfsVolume)      // map to uuid (may dup) TODO

  let mvols = Array.from(new Set(uuids)).sort()         // dedup
                .map(uuid => volumes.find(vol =>        // map to volume
                  vol.uuid === uuid))

  // if it is partitioned disk (not necessarily mounted)
  let mparts = blks.filter(blk => blk.isDisk && blk.isPartitioned)
                .reduce((prev, curr) => prev.concat(blocks.filter(blk => 
                  blk.parentName === curr.name)) , [])
                .filter(blk => blk.isMounted)

  // the left should be partition or disk with standalone fs
  let mblks = blks.filter(blk => blk.isMounted)   // filter mounted 
                .filter(blk => blk.isPartition || // is partition
                  (blk.isDisk && blk.isFileSystem && !blk.isVolumeDevice)) // is non-volume filesystem disk

  // for mounted volumes, normal umount
  // for mounted blocks (with fs)
  //  umount usb by udisksctl
  //  umount non-usb by normal umount
  let i
  for (i = 0; i < mvols.length; i++) {
    debug(`un-mounting volume ${mvols[i].uuid}`)
    await umountAsync(mvols[i].mountpoint)
  }

  for (i = 0; i < mparts.length; i++) {
    debug(`un-mounting partition ${mparts[i].name}`)
    await umountAsync(mparts[i].mountpoint)
  }

  for (i = 0; i < mblks.length; i++) {
    debug(`un-mounting block ${mblks[i].name}`)
    await umountAsync(mblks[i].mountpoint)
  }
}

/**
 * target: array of device name ['sda', 'sdb', etc]
 * mode: must be 'single', 'raid0', 'raid1'
 * init: may be removed in future
 */
const mkfsBtrfsAsync = async args => {

  let error = null

  let { target, mode } = args

  debug('mkfsBtrfs', target, mode)

  // validate mode
  if (['single', 'raid0', 'raid1'].indexOf(mode) === -1)
    throw new Error(`invalid mode: ${mode}`)

  // target must be string array
  if (!Array.isArray(target) || target.length === 0 || !target.every(name => typeof name === 'string'))
    throw new Error('invalid target names')

  let storage, blocks, volumes

  target = Array.from(new Set(target)).sort()
  storage = await Storage.refreshAsync()

  for (let i = 0; i < target.length; i++) {
    let block = storage.blocks.find(blk => blk.name === target[i])
    if (!block)
      throw new Error(`device ${target[i]} not found`)
    if (!block.isDisk)
      throw new Error(`device ${target[i]} is not a disk`)
    if (block.unformattable)
      throw new Error(`device ${target[i]} is not formattable`)
  }

  // dirty !!! FIXME
  let devnames = target.map(name => '/dev/' + name) 
  debug(`mkfs.btrfs ${mode}`, devnames)

  try {
    await umountBlocks(storage, target)
    await child.execAsync(`mkfs.btrfs -d ${mode} -f ${devnames.join(' ')}`)
    await Promise.delay(1500)
    await child.execAsync(`partprobe`) // FIXME this should be in refresh
  }
  catch (e) {
    throw e
  }
  finally {
    storage = await Storage.refreshAsync()
  }
  
  blocks = storage.blocks
  volumes = storage.volumes

  let block = blocks.find(blk => blk.name === target[0])
  let uuid = block.fileSystemUUID
  let volume = volumes.find(vol => vol.uuid === uuid)

  return uuid
}

const mkfsBtrfs = (args, callback) => 
  mkfsBtrfsAsync(args).asCallback((err, result) => {
    if (err) 
      console.log('[system] mkfs error', err)
    else
      console.log(`[system] mkfs success, volume uuid: ${result}`)
    
    callback(err, result)
  })

/**

const mkfsExt4 = async (target, opts) => {

  await refreshStorageAsync() // with decoration

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

**/

export { mkfsBtrfs, mkfsBtrfsAsync }
