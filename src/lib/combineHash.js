const crypto = require('crypto')

const combineHash = bufs =>
  bufs.length === 1
    ? bufs[0]
    : combineHash([crypto.createHash('sha256').update(bufs[0]).update(bufs[1]).digest(), ...bufs.slice(2)])

module.exports = bufs => {
  if (bufs.every(buf => buf instanceof Buffer && buf.length === 32)) {
    return combineHash(bufs)
  } else {
    throw new Error('buffers must be an array of Buffer with 32-bytes length')
  }
}
