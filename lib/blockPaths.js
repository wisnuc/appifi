'use strict'

const child = require('child_process')

const blockPaths = (done) => {

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

module.exports = blockPaths
 
