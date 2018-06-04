const stream = require('stream')
const crypto = require('crypto')

const GIGA = 1024 * 1024 * 1024

/**
Fingerprint is a writable stream calculating fingerprint.

*/
class FingerStream extends stream.Writable {
  constructor (opts) {
    super(opts)
    this.hashes = []
    this.length = 0
    this.hash = crypto.createHash('sha256')
  }

  _write (chunk, encoding, callback) {

    if (chunk.length + this.length >= GIGA) {
      let head = GIGA - this.length
      let tail = chunk.length - head

      // slice head, push digest and renew hash
      this.hash.update(chunk.slice(0, head))
      this.hashes.push(this.hash.digest())
      this.hash = crypto.createHash('sha256')

      // update hash if any tailing bytes
      if (tail) this.hash.update(chunk.slice(head))
      this.length = tail
    } else {
      this.hash.update(chunk)
      this.length += chunk.length
    }
    callback()
  }

  _final (callback) {
    // 1. if there is no hash in hashes (0 <= size <= 1G)
    // 2. when size is multiple of GIGA, the last empty hash should not be pushed.
    if (this.hashes.length === 0 || this.length) this.hashes.push(this.hash.digest())

    this.fingerprint = this.hashes
      .reduce((fp, sha256) => {
        return fp
          ? crypto.createHash('sha256').update(fp).update(sha256).digest()
          : sha256
      }, null)
      .toString('hex')

    callback()
  }
}

module.exports = FingerStream
