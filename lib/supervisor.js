'use strict'

const child = require('child_process')

const async = require('async')

const udevInfo = require('./udevInfo')
const probeMounts = require('./procmounts')
const probeSwaps = require('./probeSwaps')
const probeVolumes = require('./btrfsfishow')
const volumeUsageProbe = require('./btrfsUsage')
const dockerDaemon = require('./dockerDaemon')

/** break output into line array, trimmed **/
const toLines = (output) => 
  output.toString().split(/\n/).filter(l => l.length).map(l => l.trim())

const portPaths = (callback) => 
  child.exec('find /sys/class/ata_port -type l', (err, stdout, stderr) =>  
    err ? callback(err, {stdout, stderr}) : 
      callback(null, toLines(stdout)))

const blockPaths = (callback) => 
  child.exec('find /sys/class/block -type l', (err, stdout, stderr) => 
    err ? callback(err, {stdout, stderr}) : 
      callback(null, toLines(stdout).filter(l => l.startsWith('/sys/class/block/sd'))))

const portsUdevInfo = (callback) => 
  portPaths((err, paths) =>
    err ? callback(err, paths) : 
      udevInfo(paths, (err, sysfsDevs) => 
        callback(err, sysfsDevs)))

const blocksUdevInfo = (callback) => 
  blockPaths((err, paths) => 
    err ? callback(err, paths) :
      udevInfo(paths, (err, sysfsDevs) =>
        callback(err, sysfsDevs)))

const volumeMount = (volume, mounts) =>
  mounts.find((mnt) => volume.devices.find((dev) => dev.path === mnt.device))

const blockVolume = (block, volumes) => 
  volumes.find((vol) => vol.devices.find((dev) => dev.path === block.props.devname))

const blockMount = (block, volumes, mounts) => {

  let volume = blockVolume(block, volumes)
  return (volume) ? volumeMount(volume, mounts) :
    mounts.find((mnt) => mnt.device === block.props.devname)
}

const blockPartitions = (block, blocks) => {

  return blocks.filter((blk) => {
    blk.props.devtype === 'partition' &&
    blk.sysfsProps[1].path === block.props.devpath
  })
}


 
const blockMethods = {

  isDisk: function() {
    return this.props.devtype === 'disk'
  },

  isPartition: function() {
    return this.props.devtype === 'partition'
  },

  isBtrfsDisk: function() {
    return this.props.devtype === 'disk' && this.id_fs_usage === 'filesystem' && id_fs_type === 'btrfs'
  },

  isExt4Partition: function() {
    return  this.props.devtype === 'partition' &&
            this.props.id_fs_usage === 'filesystem' &&
            this.props.id_fs_type === 'ext4'
  },

  isSwapPartition: function() {
    return  this.props.devtype === 'partition' &&
            this.props.id_fs_usage === 'swap' &&
            this.id_fs_usage === 'other'
  },

  isFatPartition: function() {
    return  this.props.devtype === 'partition' &&
            this.props.id_fs_usage === 'filesystem' &&
            this.props.id_fs_type === 'vfat'
  },

  isMountablePartition: function() {
    return this.isFatPartition() || this.isExt4Partition()
  },
}

/*
 * storage is optional, this function can be used as first or non-first task in async waterfall
 */
const probeStorage = (storage, callback) => { /* probe all except volume usage */

  if (typeof storage === 'function') {
    callback = storage
  } 

  async.parallel(
    [
      (callback) => portsUdevInfo((err, ports) => callback(err, ports)),
      (callback) => blocksUdevInfo((err, blocks) => callback(err, blocks)), 
      (callback) => probeVolumes((err, volumes) => callback(err, volumes)),
      (callback) => probeMounts((err, mounts) => callback(err, mounts)),
      (callback) => probeSwaps((err, swaps) => callback(err, swaps)),
    ], 
    (e, r) => e ? callback(e, r) : 
      callback(null, {ports: r[0], blocks: r[1], volumes: r[2], mounts: r[3], swaps: r[4], usages: null}))
}

/*
 *
 */
const mountVolumes = (storage, callback) => {

  storage.volumes.forEach((vol) => {
   // get volume mount        
    let mnt = volumeMount(vol, storage.mounts) 
    if (mnt === undefined) { 
      try {
        let mountpoint = '/run/wisnuc/volumes/' + vol.uuid
        child.execSync(`mkdir -p ${mountpoint}`)
        vol.missing ? child.execSync(`mount -t btrfs -o degraded,ro UUID=${vol.uuid} ${mountpoint}`) :
          child.execSync(`mount -t btrfs UUID=${vol.uuid} ${mountpoint}`)
      }
      catch (e) {
        console.log(e)
      }
    }
  })
  callback(null, storage) 
}

// const probeMounts = (storage, callback) => 
// const probeUsages = (storage, callback) => 

/*
 * volumes probe first, then mount all umounted volumes, then probe usage
 */
let probe = (callback) => 
  async.waterfall(
    [ probeStorage, 
      (storage, callback) => { /* mount volumes */

        storage.volumes.forEach((vol) => {
          // get volume mount        
          let mnt = volumeMount(vol, storage.mounts) 
          if (mnt === undefined) { 
            try {
              let mountpoint = '/run/wisnuc/volumes/' + vol.uuid
              child.execSync(`mkdir -p ${mountpoint}`)
              vol.missing ? child.execSync(`mount -t btrfs -o degraded,ro UUID=${vol.uuid} ${mountpoint}`) :
                child.execSync(`mount -t btrfs UUID=${vol.uuid} ${mountpoint}`)
            }
            catch (e) {
              console.log(e)
            }
          }
        })
        callback(null, storage) 
      },
      (storage, callback) => { // re-probe mounts
        probeMounts((err, mounts) =>
          err ? callback(err, mounts) :
            callback(null, Object.assign({}, storage, { mounts }))) 
      },
      (storage, callback) => { // probe usages
        
        let usages = []
        let btrfsMounts = storage.mounts.filter((mnt) => mnt.fs_type === 'btrfs')
        
        if (btrfsMounts.length) {
          let q = async.queue((bmnt, callback) => {
            volumeUsageProbe(bmnt.mountpoint, (err, usage) => {
              if (!err) usages.push(usage)
              callback()
            }) 
          })
          q.drain = () => callback(null, storage)
          q.push(btrfsMounts) 
        }
        else {
          callback(null, storage)
        }
      }
    ], 
    (err, storage) => callback(err, storage)
  )



probe((err, storage) => {
  console.log(err)
  console.log(JSON.stringify(storage, null, '  '))
})

const configFilePath = '/etc/wisnuc.cfg'

let readConfig = (callback) => 
  fs.readFile(configFilePath, (err, data) => {
    if (err) return callback({})
   
    let config
    try {
      config = JSON.parse(data.toString())
    }
    catch (e) {
      config = {}
    }
    callback(config)
  })


let saveConfig = (config) => {
  
}

let prepareDockerFolderSync = (rootpath) => {

  if (!(typeof rootpath === 'string' || rootpath instanceof String)) throw 'rootpath must be string'
  if (rootpath.length === 0) throw 'rootpath is empty'
  if (rootpath === '/') throw 'rootpath cannot be system root'
  if (!(rootpath.startsWith('/'))) throw 'rootpath must be absolute'

  child.execSync(`mkdir -p ${rootpath}/root`)
  child.execSync(`mkdir -p ${rootpath}/graph`)
  child.execSync(`docker daemon --exec-root="${rootpath}/root" --graph="${rootpath}/graph" --host="127.0.0.1:1688" --pidfile="${rootpath}/pidfile"`)  
}

/*
 * init
 * 
 * 1. probe
 * 2. retrieve last settings
 * 3. if last set does not exist, do nothing (not set)
 * 4. if last set exists but no correspoding volume, do nothing (volume missing)
 * 5. if last set exists but corresponding volume missing, do nothing (volume incomplete)
 * 6. if last set exists and corresponding volume OK, start docker with the volume (volume complete)
 */

let init = (callback) => {

  probe((err, ports, blocks, mounts, volumes, usages) => {

    if (err) return callback(err)
    readConfig((err, config) => {
      if (err) return callback(err) // never
      if (config.dockerVolume === undefined) return callback(null)
      
      let volume = volumes.find((vol) => vol.uuid === config.dockerVolume)
      if (volume === undefined) return callback(null)
      if (volume.missing) return callback(null)

      let mount = volumeMount(volume, mounts)
      if (mount === undefined) return callback(null)
      
      dockerDaemon.start(mount.mountpoint, callback) 
    })
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
/*
let createVolume = (blknames, opts, callback) => {

  if (!blockNames.length) return setTimeout(() => callback('EINVAL'), 0)

  probe((err, ports, blocks, mounts, volumes, usages) => {

    if (err) return callback(err)

    if (!blknames.every((blkname) => {

      let block = blocks.find((blk) => blk.props.devname === blkname)
      if (!block) return false                          // invalid blkname
      if (block.props.devtype !== 'disk') return false  // not a disk (i.e. partition)
      if (block.props.id_bus !== 'ata') return false    // not ata (i.e. usb probably)

      let volume = blockVolume(block, volumes)          // if it's a volume disk
      if (volume) {
        if (volume.uuid === config.dockerVolumeUUID) return false // it is dockerVolume (user should delete dockerVolume first)
        let mnt = volumeMount(volume, mounts)
        if (mnt && mnt.mountpoint === '/') return false           // it is rootfs volume (say, the system use btrfs as rootfs)
      }
      else {                                            // it is not a volume disk
        // should check if root partion and swap partition resides on this disk FIXME
        let parts = blockPartitions(block, blocks)
        if (parts.length) {
        }
      }
    })) return callback('EINVAL')

    // generate list to be unmounted
      
    
}
*/


