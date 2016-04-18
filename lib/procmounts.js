'use strict'

const fs = require('fs')
const path = require('path')

module.exports = (done) => {

  fs.readFile('/proc/mounts', (err, data) => {

    if (err) return (err, null)

    let lines = data.toString().split(/\n/).filter(l => l.length)

    let all = lines.map(l => {
      let tmp = l.split(' ')
      return {
        device: tmp[0],
        mountpoint: tmp[1],
        fs_type: tmp[2],
        opts: tmp[3].split(',') 
      }
    })

    let filtered = all.filter(m => (m.device.startsWith('/dev/sd') || m.device.startsWith('/dev/mmc')))
    done(null, filtered)
  })
}


