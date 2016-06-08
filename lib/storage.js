const child = require('child_process')

import { toLines } from './utils'
import { storeState, storeDispatch } from 'lib/reducers'
import { probeDaemon } from 'lib/docker'

const udevInfo = require('./udevInfoAsync')
const probeMounts = require('./procMountsAsync')
const probeSwaps = require('./procSwapsAsync')
const probeVolumes = require('./btrfsfishowAsync')
const probeUsage = require('./btrfsusageAsync')

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

function volumeMount(volume, mounts) {
  return mounts.find((mnt) => volume.devices.find((dev) => dev.path === mnt.device))
}

function blockVolume(block, volumes) {
  return volumes.find((vol) => vol.devices.find((dev) => dev.path === block.props.devname))
}

function blockMount(block, volumes, mounts) {

  let volume = blockVolume(block, volumes)
  return (volume) ? volumeMount(volume, mounts) :
    mounts.find((mnt) => mnt.device === block.props.devname)
}

function blockPartitions(block, blocks) {

  return blocks.filter((blk) => {
    blk.props.devtype === 'partition' &&
    blk.sysfsProps[1].path === block.props.devpath
  })
}

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

  let debug = false
  return new Promise((resolve) => // never reject
    child.exec(cmd, (err, stdout, stderr) => {
      debug && console.log('---- execAnyway')
      debug && console.log({cmd, err, stdout, stderr})
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
  let usages = await probeUsages(mounts)
  return Object.assign({}, storage, {mounts, usages})
}

async function refreshStorage() {

  let obj = await probeStorageWithUsages()
  storeDispatch({
    type: 'STORAGE_UPDATE',
    data: obj
  })
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

async function createVolume(blknames, opts) {
 
  let debug = true

  if (!blknames.length) throw new InvalidError('device names empty')

  // undupe
  blknames = blknames.filter((blkname, index, self) => index === self.indexOf(blkname))

  debug && console.log('---- blknames')
  debug && console.log(blknames)

  // probe storage
  let storage = await probeStorage()
  let daemon = await probeDaemon()

  if (storage.blocks === null) return
  if (storage.blocks.length === 0) return

  // validate
  blknamesValidation(blknames, storage.blocks, storage.volumes, storage.mounts, storage.swaps, daemon)

  // find mounted mountpoints
  let mps = blknamesMounted(blknames, storage.blocks, storage.volumes, storage.mounts)
  debug && console.log('---- blknames mounted:')
  debug && console.log(mps)

  // umount mounted
  await Promise.all(mps.map(mp => new Promise((resolve, reject) => {
    child.exec(`umount ${mp}`, (err, stdout, stderr) => 
      err ? reject(err) : resolve(stdout))
  })))
  debug && console.log('---- unmount mounted blknames successfully')


  let stdout = await new Promise((resolve, reject) => {
    child.exec(`mkfs.btrfs -f ${blknames.join(' ')}`, (err, stdout, stderr) => {
      err ? reject(err) : resolve(stdout)
    })   
  })

  debug && console.log('---- mkfs.btrfs successfully')

  storage = await probeStorageWithUsages()
  return storage.volumes.find(vol => 
    (vol.devices.length === blknames.length) &&
      vol.devices.every(dev => blknames.find(bn => bn === dev.path)))  
 
  /////////////////////////////////////////////////////////////////////////////

  function blknamesValidation(blknames, blocks, volumes, mounts, swaps, daemon) {

    blknames.forEach((blkname) => {

      // find corresponding block (object)
      let block = blocks.find((blk) => blk.props.devname === blkname)

      if (!block) throw new InvalidError(blkname + ' not found')
      if (block.props.devtype !== 'disk') throw new InvalidError(blkname + ' is not a disk')
      if (block.props.id_bus !== 'ata') throw new InvalidError(blkname + ' is not ata disk')

      // check if the block belongs to a volume
      let volume = blockVolume(block, volumes)
      if (volume) {
        if (daemon.running && daemon.volume === volume.uuid) throw new InvalidError(`${blkname} is a device of running app engine volume, stop app engine before proceeding`)
        let mnt = volumeMount(volume, mounts)
        if (mnt && mnt.mountpoint === '/') throw new InvalidError(`${blkname} is a device of system volume`)
      }
      else {                      
        let parts = blockPartitions(block, blocks)
        parts.forEach(part => {
          let mnt = blockMount(part, volumes, mounts)
          if (mnt && mnt.mountpoint === '/')  throw new InvalidError(`${blkname} contains root partition ${part.devname}`)
          if (swaps.find(swap => swap.filename === part.devname)) throw new InvalidError(`${blkname} contains swap partition ${part.devname}`)
        })
      }
    })    
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
    console.log(req.args)

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

