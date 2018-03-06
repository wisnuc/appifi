const Promise = require('bluebird')
const child = Promise.promisifyAll(require('child_process'))
const os = require('os')
const udevInfoAsync = require('./udevInfoAsync')

/**
Probe ports
@returns raw ports
*/

/**
module.exports = async () => udevInfoAsync((
  await child.execAsync('find /sys/class/ata_port -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length))
**/

module.exports = async () => {
  if (os.arch() === 'x64') {
    let output = await child.execAsync('find /sys/class/ata_port -type l')
    let paths = output.toString().split('\n').map(l => l.trim()).filter(l => l.length)
    return udevInfoAsync(paths)
  } else {
    return []
  }
}
