import fs from 'fs';

let target = '/home/laraine/Projects/appifi/testFolder/a.js'
fs.stat(target, (err, stats) => {
  // if(err) return callback(err)
  console.log(stats)
})
