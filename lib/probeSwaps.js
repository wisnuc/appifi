'use strict'

const fs = require('fs')

let probeSwaps = (callback) => 
  fs.readFile('/proc/swaps', (err, data) => 
    err ? callback(err) : callback(null,    
      data.toString().split(/\n/).filter(l => l.length)
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
        })))

module.exports = probeSwaps

