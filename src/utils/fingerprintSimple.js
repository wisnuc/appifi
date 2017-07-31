const fs = require('fs')
const crypto = require('crypto')

module.exports = (filePath, callback) => {

  console.log(`====== calculating fingerprint for ${filePath} ======`)

  let fd, stat, totalRead = 0, fingerprint

  const buffer = Buffer.alloc(1024 * 1024 * 1024)

  const cb = (err, fingerprint) => {
    if (fd) fs.close(fd, e => e && console.log(e))
    callback(err, fingerprint)
  }

  try {
    fd = fs.openSync(filePath, 'r')
    stat = fs.fstatSync(fd)
  } catch (e) {
    return cb(e)
  }

  if (stat.size === 0) {

    fingerprint = crypto.createHash('sha256').digest()
    console.log('  fingerprint', fingerprint) 
    console.log(`  totalRead: ${totalRead}, file size: ${stat.size}`)

    return process.nextTick(() => cb(null, fingerprint.toString('hex')))
  }

  let round = 0

  const Loop = () => fs.read(fd, buffer, 0, 1024 * 1024 * 1024, totalRead, (err, bytesRead, buffer) => {

    console.log(`round: ${round}, position: ${totalRead}, bytesRead: ${bytesRead}`)
    round++

    if (err) return cb(err)
    if (bytesRead === 0) return cb(new Error('bytes read 0'))  

    let digest = crypto.createHash('sha256').update(buffer.slice(0, bytesRead)).digest()
    console.log('  digest: ', digest)

    if (!fingerprint)
      fingerprint = digest
    else
      fingerprint = crypto.createHash('sha256').update(fingerprint).update(digest).digest()

    console.log('  fingerprint', fingerprint)

    totalRead += bytesRead 

    console.log(`  totalRead: ${totalRead}, file size: ${stat.size}`)

    if (totalRead === stat.size) return cb(null, fingerprint.toString('hex'))
    setImmediate(Loop) 
  })

  Loop()
}

