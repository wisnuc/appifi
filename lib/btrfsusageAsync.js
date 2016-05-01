'use strict'

const child = require('child_process')
const async = require('async')

const btrfs_filesystem_usage = (mountpoint, done) => {

  let tmp, cmd = 'btrfs filesystem usage -b ' + mountpoint

  child.exec(cmd, (error, stdout, stderr) => {

    let result = { 
      overall: {},
      data: { devices: [] },
      metadata: { devices: [] },
      system: { devices: [] },
      unallocated: { devices: [] }
    }

    let o = result.overall

    let filling = null
    
    stdout.toString().split(/\n\n/)
    .forEach(sec => {

      if (sec.startsWith('Overall')) {

        sec.split(/\n/).filter(l => l.startsWith('  '))
          .map(l => l.replace(/\t+/, ' ').trim())
          .forEach(l => {
           
            let tmp = l.split(': ').map(s => s.trim())

            if (tmp[0] === 'Device size') {
              o.deviceSize = parseInt(tmp[1])
            }
            else if (tmp[0] === 'Device allocated') {
              o.deviceAllocated = parseInt(tmp[1])
            }
            else if (tmp[0] === 'Device unallocated') {
              o.deviceUnallocated = parseInt(tmp[1])
            }
            else if (tmp[0] === 'Device missing') {
              o.deviceMissing = parseInt(tmp[1])
            }
            else if (tmp[0] === 'Used') {
              o.used = parseInt(tmp[1])
            }
            else if (tmp[0] === 'Free (estimated)') {
              o.free = parseInt(tmp[1])
              o.freeMin = parseInt(tmp[2])
            }
            else if (tmp[0] === 'Data ratio') {
              o.dataRatio = tmp[1]
            }
            else if (tmp[0] === 'Metadata ratio') {
              o.metadataRatio = tmp[1]
            }
            else if (tmp[0] === 'Global reserve') {
              o.globalReserve = parseInt(tmp[1])
              o.globalReserveUsed = parseInt(tmp[2])
            }
            else {
            }
          }) 
      }
      else {
        sec.split(/\n/).filter(l => l.length)
          .forEach(l => {
            if (l.startsWith('Data') || l.startsWith('Metadata') || l.startsWith('System') || l.startsWith('Unallocated')) {

              tmp = l.split(' ').filter(l => l.length)

              if (l.startsWith('Data')) {
                result.data.mode = tmp[0].slice(5,-1)
                result.data.size = parseInt(tmp[1].slice(5,-1))
                result.data.used = parseInt(tmp[2].slice(5))
                filling = 'data'
              }
              else if (l.startsWith('Metadata')) {
                result.metadata.mode = tmp[0].slice(9,-1)
                result.metadata.size = parseInt(tmp[1].slice(5,-1))
                result.metadata.used = parseInt(tmp[2].slice(5))
                filling = 'metadata'
              }
              else if (l.startsWith('System')) {
                result.system.mode = tmp[0].slice(7,-1)
                result.system.size = parseInt(tmp[1].slice(5,-1))
                result.system.used = parseInt(tmp[2].slice(5))
                filling = 'system'
              }
              else if (l.startsWith('Unallocated')) {
                filling = 'unallocated'
              }
            }
            else {
              tmp = l.replace(/\t+/, ' ').split(' ').filter(l => l.length)
              if (tmp[0].startsWith('/dev/')) {
                result[filling].devices[tmp[0]] = tmp[1]
              }
            }
          })
      }
    })
    done(null, result)
  })
}


function btrfs_device_usage(mountpoint, done) {
  
  let cmd = 'btrfs device usage -b ' + mountpoint

  let parser = (error, stdout, stderr) => {

    // console.log('btrfs dev usage ' + error + stdout + stderr)
    
    if (error) return done(error, { stdout, stderr })
    
    let lines = stdout.toString().split(/\n/).map(l => l.trim()).filter(l => l.length)
    let result = []
    let dev = null

    lines.forEach(l => {

      let tmp = l.split(' ').filter(l => l.length)

      if (l.startsWith('/dev')) {
        if (dev) result.push(dev)
        dev = { data: {}, metadata: {}, system: {} }
        dev.name = tmp[0].slice(0, -1)
        dev.id = parseInt(tmp[2])
      }
      else if (l.startsWith('Device size')) {
        dev.size = parseInt(tmp[2])
      }
      else if (l.startsWith('Data')) {
        dev.data.mode = tmp[0].slice(5, -1)
        dev.data.size = parseInt(tmp[1])
      }
      else if (l.startsWith('Metadata')) {
        dev.metadata.mode = tmp[0].slice(9, -1)
        dev.metadata.size = parseInt(tmp[1])
      }
      else if (l.startsWith('System')) {
        dev.system.mode = tmp[0].slice(7, -1)
        dev.system.size = parseInt(tmp[1])
      }
      else if (l.startsWith('Unallocated')) {
        dev.unallocated = parseInt(tmp[1])
      }
    })
  
    if (dev) result.push(dev)
    done(null, result)  
  }

  child.exec(cmd, parser)
}

module.exports = (mountpoint, done) => {

  async.parallel([
    (done) => btrfs_filesystem_usage(mountpoint, (e, r) => done(e, r)),
    (done) => btrfs_device_usage(mountpoint, (e, r) => done(e, r))
  ],
  (error, result) => {
    // console.log(result[0])
    // console.log(result[1])
    done(error, result)
  })
}



