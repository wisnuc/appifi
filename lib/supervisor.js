'use strict'

const child = require('child_process')

const async = require('async')

const udevInfo = require('./udevinfo')
const mountsProbe = require('./procmounts')
const volumesProbe = require('./btrfsfishow')

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



/**

  let data = {
    ports : [],
    blocks : []
  }

  // collect sysfs paths for block devices
  portsAndBlockPaths((err, paths) => {

    if (err) return callback(err, paths)
    udevInfo(paths, (err, sysfsDevs) => {

      if (err) return callback(err, sysfsDevs)

      sysfsDevs.forEach(dev => {
        
        let ss = dev.props.subsystem

        // console.log(dev)
        if (ss === 'ata_port') {
          data.ports.push(dev)
          dev.blockDevName = null
        }
        else if (ss === 'block') {
          data.blocks.push(dev)
        }
      })

      data.ports.forEach(port => {
        
        let portParent = port.sysfsProps[1] 

        for (let i = 0; i < data.blocks.length; i++) {
          
          let b = data.blocks[i]
          if (b.path.startsWith(portParent.path)) {
            // found
            port.blockDevName = b.props.devname
            return
          }
        }
      })
    
      callback(null, data)
    }) 
  })
}

**/

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


portsUdevInfo((e, r) => {

  console.log('portsUdevInfo')
  if (e) return console.log(e)

  console.log(r)
  ports = r
  bmvProbe((e, r) => {

    console.log('bmvProbe') 
    if (e) return console.log(e)
    
    console.log(ports)
    console.log(blocks)
    console.log(mounts)
    console.log(volumes)    
  })
})



























