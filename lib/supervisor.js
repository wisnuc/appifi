'use strict'

const child = require('child_process')

const async = require('async')

const udevInfo = require('./udevinfo')
const mountsProbe = require('./procmounts')
const volumesProbe = require('./btrfsfishow')
const volumeUsageProbe = require('./btrfsUsage')

let ports, blocks, mounts, volumes 

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
        
const bmvProbe = (callback) => {

  blocks = mounts = volumes = null
  async.parallel([blocksUdevInfo, mountsProbe, volumesProbe], (err, result) => {

    if (err) return callback(err, result)
    blocks = result[0]
    mounts = result[1]
    volumes = result[2]  
    callback(null) 
  })
}

const init = (callback) => 
  portsUdevInfo((e, r) => e ? callback(e, r) : ports = r)

var storage = require('./storage')

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

storage((err, data) => {

  if (err) return callback(err, data)

  let blocks = data.blocks
                .map((blk) => Object.assign({}, blk, blockMethods)) 
                .filter((blk) => {
                  // if (blk.isFatPartition()) console.log(blk.name + ' is fat partition')
                  // if (blk.isExt4Partition()) console.log(blk.name + ' is ext4 partition')
                  return (blk.isFatPartition() || blk.isExt4Partition())
                })
                .filter((blk) => {  // remove root partition
                  let mounts = data.mounts
                  
                  for (let i = 0; i < mounts.length; i++) {
                    if (mounts[i].mountpoint === '/' && mounts[i].device === blk.props.devname)
                      return false
                  }
                  return true
                })

//  console.log(blocks)
  console.log(JSON.stringify(blocks, null, '  '))
})


let volumeMount = (volume, mounts) =>
  mounts.find((mnt) => volume.devices.find((dev) => dev.path === mnt.device))

/*
 * volumes probe first, then mount all umounted volumes, then probe usage
 */
async.waterfall(
  [ (callback) => { /* probe all except volume usage */
      async.parallel([
        (callback) => portsUdevInfo((err, ports) => callback(err, ports)),
        (callback) => blocksUdevInfo((err, blocks) => callback(err, blocks)), 
        (callback) => mountsProbe((err, mounts) => callback(err, mounts)),
        (callback) => volumesProbe((err, volumes) => callback(err, volumes))
      ], (err, result) => {
        err ? callback(err, result) : callback(null, result[0], result[1], result[2], result[3])
      })
    }, 
    (ports, blocks, mounts, volumes, callback) => { /* mount volumes */

      volumes.forEach((vol) => {
        // get volume mount        
        let mnt = volumeMount(vol, mounts) 
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
      callback(null, ports, blocks, mounts, volumes) 
    },
    (ports, blocks, mounts, volumes, callback) => { // re-probe mounts 

      mountsProbe((err, mounts) =>
        err ? callback(err, mounts) :
          callback(null, ports, blocks, mounts, volumes)) 
    },
    (ports, blocks, mounts, volumes, callback) => {
      
      let usages = []
      let btrfsMounts = mounts.filter((mnt) => mnt.fs_type === 'btrfs')
      
      if (btrfsMounts.length) {
        let q = async.queue((bmnt, callback) => {
          volumeUsageProbe(bmnt.mountpoint, (err, usage) => {
            if (!err) usages.push(usage)
            callback()
          }) 
        })
        q.drain = () => callback(null, ports, blocks, mounts, volumes, usages)
        q.push(btrfsMounts) 
      }
      else {
        callback(null, ports, blocks, mounts, volumes, usages)
      }
    }
  ], 
  (err, ports, blocks, mounts, volumes, usages) => {
    console.log(err)
    console.log(ports)
    console.log(blocks)
    console.log(mounts)
    console.log(volumes)
    console.log(usages)
  }
)






















