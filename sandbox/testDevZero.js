const fs = require('fs')
let count = 0
let rs = fs
  .createReadStream('/dev/zero')
  .on('data', data => (count += data.length))

setInterval(() => (console.log(Math.floor(count / (1024 * 1024))), count = 0), 1000)
