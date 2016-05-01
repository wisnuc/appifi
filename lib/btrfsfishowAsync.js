'use strict'

const child = require('child_process')
const async = require('async')

class BtrfsVolume {

  constructor () {
    this.missing = false
    this.devices = []
  }

  isValid() {
    if ((this.devices.length === this.total) && this.label && this.uuid && this.used)
      return true
    return false
  }

  isMissing() {
    
    for (let i = 0; i < this.devices.length; i++) {
      if (!this.devices[i].path) return true
    }
    return false
  }

  getDevNames () {
    return this.devices.filter(d => d.path).map(d => d.path)
  }

  devInVolume (devname) {
    return this.getDevNames().indexOf(devname) > -1
  }
}

/*
 * parse single volume info
 */ 
const btrfs_fi_show_uuid = async (uuid) => {

  let stdout = await new Promise((resolve, reject) => 
    child.exec('btrfs fi show ' + uuid, (err, stdout, stderr) => 
      err ? reject(err) : resolve(stdout)))

  if (error) done(error, { stdout, stderr })
  var lines =  stdout.toString().split(/\n/).filter(l => l.length).map(l => l.trim())
  var vol = new BtrfsVolume()

  lines.forEach(l => {

    if (l.startsWith('Label')) {   // FIXME if label is none, this fails         
      var opening = l.indexOf("'")
      var closing = l.lastIndexOf("'")
      vol.label = l.slice(opening + 1, closing)
      var tmp = l.split(' ')
      vol.uuid = tmp[tmp.length - 1] // last one
    }
    else if (l.startsWith('Total')) {
      var tmp = l.split(' ')
      vol.total = parseInt(tmp[2])
      vol.used = tmp[6]
    }
    else if (l.startsWith('devid')) {
      var tmp = l.split(' ').filter(l => l.length)
      vol.devices.push({
        id: parseInt(tmp[1]),
        size: tmp[3],
        used: tmp[5],
        path: tmp[7]               
      });
    }
    // FIXME warning devid 2 not found already (not sure stdout or stderr)
    // FIXME also, the error message won't print if volume mounted
    // warning, device 2 is missing
    else if (l.startsWith('warning, device')) {
      let tmp = l.split(' ')
      vol.devices.push({
        id: parseInt(tmp[2])
      });
    }
    else if (l.startsWith('*** Some devices missing')) {
      vol.missing = true
    }
    else {
      console.log("unexpected behavior")
      console.log("----")
      console.log(l)
      console.log("----")
    }
  })

  // sort devices by id
  return vol.devices.sort((a, b) => a.id - b.id)
} 

const btrfs_fi_show = async () => {

  let cmd = "btrfs fi show | grep -P '^Label: ' | sed -n -e 's/^.*uuid: //p'"

  // FIXME btrfs fi show returns success exit code and nothing if not root
  let stdout = await new Promise((resolve, reject) => 
    child.exec(cmd, (err, stdout, stderr) => 
      err ? reject(err) : resolve(stdout)))

  let uuids = stdout.toString().split(/\n/).filter(l => l.length)

  return Promise.all(uuids.map(uuid => btrfs_fi_show_uuid(uuid)))
}

module.exports = btrfs_fi_show

btrfs_fi_show().then((result) => console.log(result))

