const Promise = require('bluebird')
const child = Promise.promisifyAll(require('child_process'))
const udevInfoAsync = require('./udevInfoAsync')

/**
Probe ports
@returns raw ports
*/
module.exports = async () => udevInfoAsync((
  await child.execAsync('find /sys/class/ata_port -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length))
