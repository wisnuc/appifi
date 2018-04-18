const Promise = require('bluebird')
const child = Promise.promisifyAll(require('child_process'))
const udevInfoAsync = require('./udevInfoAsync')

/**
Probe blocks
@returns raw blocks
*/
module.exports = async () => udevInfoAsync((
  await child.execAsync('find /sys/class/block -type l'))
    .toString().split('\n').map(l => l.trim()).filter(l => l.length)
    .filter(l => l.startsWith('/sys/class/block/vd') || l.startsWith('/sys/class/block/sd')))

