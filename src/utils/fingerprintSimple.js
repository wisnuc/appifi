const fs = require('fs')
const crypto = require('crypto')
const debug = require('debug')('fingerprintSimple')

const fingerprintSimple = (filePath, callback) => {

  debug(`====== calculating fingerprint for ${filePath} ======`)

  let fd, stat, totalRead = 0, fingerprint

  const buffer = Buffer.alloc(1024 * 1024 * 1024)

  const cb = (err, fingerprint) => {
    if (fd) fs.close(fd, e => e && debug(e))
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
    debug('  fingerprint', fingerprint) 
    debug(`  totalRead: ${totalRead}, file size: ${stat.size}`)

    return process.nextTick(() => cb(null, fingerprint.toString('hex')))
  }

  let round = 0

  const Loop = () => fs.read(fd, buffer, 0, 1024 * 1024 * 1024, totalRead, (err, bytesRead, buffer) => {

    debug(`round: ${round}, position: ${totalRead}, bytesRead: ${bytesRead}`)
    round++

    if (err) return cb(err)
    if (bytesRead === 0) return cb(new Error('bytes read 0'))  

    let digest = crypto.createHash('sha256').update(buffer.slice(0, bytesRead)).digest()
    debug('  digest: ', digest)
    if (!fingerprint)
      fingerprint = digest
    else
      fingerprint = crypto.createHash('sha256').update(fingerprint).update(digest).digest()

    debug('  fingerprint', fingerprint)

    totalRead += bytesRead 

    debug(`  totalRead: ${totalRead}, file size: ${stat.size}`)

    if (totalRead === stat.size) return cb(null, fingerprint.toString('hex'))
    setImmediate(Loop) 
  })

  Loop()
}

const fingerprintSimpleSync = filePath => {
  let fd = fs.openSync(filePath, 'r') 
  let stat = fs.fstatSync(fd)

  if (stat.size === 0) return crypto.createHash('sha256').digest('hex') 

  const buffer = Buffer.alloc(1024 * 1024 * 1024)
  let totalRead = 0 
  let fingerprint 
  while (true) {
    let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 1024, totalRead)
    if (bytesRead === 0) throw new Error('zero bytes read')

    let digest = crypto.createHash('sha256').update(buffer.slice(0, bytesRead)).digest()
    fingerprint = fingerprint 
      ? crypto.createHash('sha256').update(fingerprint).update(digest).digest()
      : digest
      
    totalRead += bytesRead
    if (totalRead === stat.size) return fingerprint.toString('hex')
  }
}

fingerprintSimple.sync = fingerprintSimpleSync

module.exports = fingerprintSimple

if (process.argv.includes('--standalone')) {
  let index = process.argv.indexOf('--path')
  if (index !== -1 && index < process.argv.length - 1) {

    fingerprintSimple(process.argv[index + 1], (err, fingerprint) => {
      debug(err || fingerprint)
    })
  }
}
