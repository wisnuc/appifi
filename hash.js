const crypto = require('crypto')
const fs = require('fs')

let stream = fs.createReadStream(process.argv[2])
let os = fs.createWriteStream('tmpout')
let hash = crypto.createHash('sha256')

stream.pipe(hash).pipe(process.stdout)
stream.pipe(os)


