const readLine = require('readline')
const fs = require('fs')
let rl = readLine.createInterface({
    input: fs.createReadStream('tmptest/boxes/a96241c5-bfe2-458f-90a0-46ccd1c2fa9a/recordsDB'),
    crlfDelay: Infinity
})
let size = 0
rl.on('line', line => {
    size += new Buffer(line).length
})

rl.on('close', () => {
    console.log('再见!', size)
})