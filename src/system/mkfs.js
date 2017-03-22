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
const umountBlocks = async (adapted, target) => {

  debug('unmounte blocks, adapted, target', adapted, target)

  let {blocks, volumes } = adapted

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
const mkfsBtrfsAsync = async (target, mode, init) => {

  let error = null

  debug('mkfsBtrfs', target, mode)

  // validate mode
  if (['single', 'raid0', 'raid1'].indexOf(mode) === -1)
    throw new Error('invalid mode')

  // target must be string array
  if (!Array.isArray(target) || target.length === 0 || !target.every(name => typeof name === 'string'))
    throw new Error('invalid target names')

  let storage, adapted, blocks, volumes

  target = Array.from(new Set(target)).sort()
  adapted = await Storage.refreshAsync(true)

  for (let i = 0; i < target.length; i++) {
    let block = adapted.blocks.find(blk => blk.name === target[i])
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
    await umountBlocks(adapted, target)
    await child.execAsync(`mkfs.btrfs -d ${mode} -f ${devnames.join(' ')}`)
    await Promise.delay(1500)
    await child.execAsync(`partprobe`)
  }
  catch (e) {
    await Storage.refreshAsync()
    throw e
  }
  
  adapted = Storage.refreshAsync(true)

  blocks = adapted.blocks
  volumes = adapted.volumes

  debug('target[0]', target[0])
  let block = blocks.find(blk => blk.name === target[0])
 
  debug('block', block) 
  let uuid = block.fileSystemUUID

  debug('uuid', uuid)
  let volume = volumes.find(vol => vol.uuid === uuid)

  debug('volume')
  let mp = volume.mountpoint

  debug('mountpoint')

  console.log('[system] mkfs.btrfs success', volume)

  if (init) {
    await installFruitmixAsync(mp, init) 
    debug('fruitmix installed')  
  }

  return uuid
}

const mkfsBtrfs = (target, mode, init, callback) => {

  if (typeof init === 'function') {
    callback = init
    init = undefined
  }

  mkfsBtrfsAsync(target, mode, init).asCallback(callback)
}

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

export { mkfsBtrfs, mkfsBtrfsAsync }
