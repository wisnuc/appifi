'use strict'

const child = require('child_process')

/*
 * parse single volume info
 */ 
async function btrfs_fi_show_uuid(uuid) {

  let stdout = await new Promise((resolve, reject) => 
    child.exec('btrfs fi show ' + uuid, (err, stdout) => // stderr not used 
      err ? reject(err) : resolve(stdout)))

  let lines = stdout.toString().split(/\n/).filter(l => l.length).map(l => l.trim())
  let vol = {
    missing: false,
    devices: []
  }

  lines.forEach(l => {

    if (l.startsWith('Label')) {   // FIXME if label is none, this fails         
      if (l.startsWith('Label: none ')) {
        vol.label = ''
        let tmp = l.split(' ').filter(l => l.length)
        vol.uuid = tmp[tmp.length - 1]
      }
      else {
        let opening = l.indexOf('\'')
        let closing = l.lastIndexOf('\'')
        vol.label = l.slice(opening + 1, closing)
        let tmp = l.split(' ')
        vol.uuid = tmp[tmp.length - 1] // last one
      }
    }
    else if (l.startsWith('Total')) {
      let tmp = l.split(' ')
      vol.total = parseInt(tmp[2])
      vol.used = tmp[6]
    }
    else if (l.startsWith('devid')) {
      let tmp = l.split(' ').filter(l => l.length)
      vol.devices.push({
        id: parseInt(tmp[1]),
        size: tmp[3],
        used: tmp[5],
        path: tmp[7]               
      })
    }
    // FIXME warning devid 2 not found already (not sure stdout or stderr)
    // FIXME also, the error message won't print if volume mounted
    // warning, device 2 is missing
    else if (l.startsWith('warning, device')) {
      let tmp = l.split(' ')
      vol.devices.push({
        id: parseInt(tmp[2])
      })
    }
    else if (l.startsWith('*** Some devices missing')) {
      vol.missing = true
    }
    else {
      console.log('unexpected behavior')
      console.log('----')
      console.log(l)
      console.log('----')
    }
  })

  // sort devices by id
  vol.devices.sort((a, b) => a.id - b.id)
  return vol
} 

const btrfs_fi_show = async () => {

  let cmd = 'btrfs fi show | grep -P \'^Label: \' | sed -n -e \'s/^.*uuid: //p\''

  // FIXME btrfs fi show returns success exit code and nothing if not root
  let stdout = await new Promise((resolve, reject) => 
    child.exec(cmd, (err, stdout) => // stderr not used
      err ? reject(err) : resolve(stdout)))

  let uuids = stdout.toString().split(/\n/).filter(l => l.length)
  return Promise.all(uuids.map(uuid => btrfs_fi_show_uuid(uuid)))
}

module.exports = btrfs_fi_show

// btrfs_fi_show().then((result) => console.log(result))

