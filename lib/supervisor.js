'use strict'

const child = require('child_process')

const udevInfo = require('./udevinfo')

const portsAndBlockPaths = (done) => {

  child.exec('find /sys/class/block /sys/class/ata_port -type l', (err, stdout, stderr) => {
    
    if (err) return done(err, {stdout, stderr})

    let result = stdout.toString().split(/\n/).filter(l => l.length).map(l => l.trim())
    let filtered = result.filter(l => {
      
      if (l.startsWith('/sys/class/block/sd')) return true
      if (l.startsWith('/sys/class/ata_port/ata')) return true
      return false
    })
    done(null, filtered)
  })
}

const blockUdevInfo = (callback) => {

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

const blockInVolume = (block, volume) => {

  for (var i = 0; i < volume.devices.length; i++) {
    
  //  if (block.
  }
}

storage((err, data) => {

  if (err)
    return callback(err, data)
  // console.log(JSON.stringify(data, null, '  '))  

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






























