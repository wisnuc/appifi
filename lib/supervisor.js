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

blockUdevInfo((err, data) => {
  console.log(JSON.stringify(data, null, '  '))
})


