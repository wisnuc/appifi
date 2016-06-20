'use strict'

const fs = require('fs')

const procSwaps = async () => {

  let data = await new Promise((resolve, reject) => 
    fs.readFile('/proc/swaps', (err, data) => 
      err ? reject(err) : resolve(data))) 

  return data.toString().split(/\n/).filter(l => l.length)
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
}

module.exports = procSwaps

// procSwaps().then((result) => console.log(result))

