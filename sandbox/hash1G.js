const crypto = require('crypto')
const Hash = crypto.createHash('sha256')

const buffer = Buffer.allocUnsafe(1024 * 1024 * 1024)

console.time('hash')
console.log(Hash.update(buffer).digest('hex'))
console.timeEnd('hash')
