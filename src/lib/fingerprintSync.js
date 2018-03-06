const fs = require('fs')
const crypto = require('crypto')

const fingerprint = (path, callback) => {

  const hashes = [] 
  const rs = fs.createReadStream(path, { highWaterMark: 1024 * 1024 * 1024 })

  rs.on('error', err => {
    rs.removeAllListeners()
    rs.on('error', () => {})
    callback(err)
  })

  rs.on('data', data => {
    let size = data.length
    let sha256 = crypto.createHash('sha256').update(data).digest()
    hashes.push({ size, sha256 })
  })

  rs.on('end', () => {
    if (!hashes.slice(0, -1).every(x => x.size === 1024 * 1024 * 1024)) {
      console.log(hashes)
      return callback(new Error('bad block size'))
    }

    if (hashes.length === 0) {
      callback(null, crypto.createHash('sha256').digest('hex'))
    } else {
      let fingerprint = hashes.shift().sha256
      while (hashes.length) 
        fingerprint = crypto
          .createHash('sha256')
          .update(Buffer.concat([fingerprint, hashes.shift().sha256]))
          .digest()

      callback(null, fingerprint.toString('hex'))
    } 
  })
}

module.exports = fingerprint

