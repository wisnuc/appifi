const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

module.exports = async () =>
  (await fs.readFileAsync('/proc/swaps'))
    .toString().split(/\n/).filter(l => l.length)
    .map(l => l.replace(/\t/g, ' '))
    .filter(l => !l.startsWith('Filename'))
    .map(l => {
      let tmp = l.split(' ').filter(l => l.length)
      return {
        filename: tmp[0],
        type: tmp[1],
        size: tmp[2],
        used: tmp[3],
        priority: tmp[4]
      }
    })
