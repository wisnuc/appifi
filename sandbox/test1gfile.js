const fs = require('fs')
const crypto = require('crypto')

let hash = crypto.createHash('sha256')
let data = crypto.createHash('sha256').digest()         // size 32
let buffer = Buffer.concat(new Array(1024).fill(data))  // 32 x 1K = 32K

console.log('buffer length:', buffer.length)

let ws = fs.createWriteStream('xxhash1g')

ws.on('error', err => {
  console.log(err)
  process.exit(1)
})

ws.on('finish', () => {
  let stat = fs.lstatSync('xxhash1g')  
  console.log(stat.size === 1024 * 1024 * 1024)
})

let count = 1024 * 1024 * 1024 / buffer.length
console.log('count:', count)

const Loop = () => {
  hash.update(buffer)
  ws.write(buffer) 
  if (!--count) {
    console.log(hash.digest('hex'))
    ws.end()
  } else {
    setImmediate(Loop)
  }
}

Loop()


