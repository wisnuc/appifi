const Promise = require('bluebird')
const child = Promise.promisifyAll(require('child_process'))

/*
 * parse single volume info
 */
const btrfsFiShowUUID = async (uuid) => {
  let stdout = await child.execAsync(`btrfs fi show ${uuid}`)

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
      } else {
        let opening = l.indexOf('\'')
        let closing = l.lastIndexOf('\'')
        vol.label = l.slice(opening + 1, closing)
        let tmp = l.split(' ')
        vol.uuid = tmp[tmp.length - 1] // last one
      }
    } else if (l.startsWith('Total')) {
      let tmp = l.split(' ')
      vol.total = parseInt(tmp[2])
      vol.used = tmp[6]
    } else if (l.startsWith('devid')) {
      let tmp = l.split(' ').filter(l => l.length)
      vol.devices.push({
        id: parseInt(tmp[1]),
        size: tmp[3],
        used: tmp[5],
        path: tmp[7]
      })
    } else if (l.startsWith('warning, device')) {
      // FIXME warning devid 2 not found already (not sure stdout or stderr)
      // FIXME also, the error message won't print if volume mounted
      // warning, device 2 is missing
      let tmp = l.split(' ')
      vol.devices.push({
        id: parseInt(tmp[2])
      })
    } else if (l.startsWith('*** Some devices missing')) {
      vol.missing = true
    } else {
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

module.exports = async uuid => {
  if (uuid) return btrfsFiShowUUID(uuid)

  let cmd = 'btrfs fi show | grep -P \'^Label: \' | sed -n -e \'s/^.*uuid: //p\''

  // FIXME btrfs fi show returns success exit code and nothing if not root
  let stdout = await child.execAsync(cmd)
  let uuids = stdout.toString().split(/\n/).filter(l => l.length)

  return Promise.map(uuids, uuid => btrfsFiShowUUID(uuid))
}
