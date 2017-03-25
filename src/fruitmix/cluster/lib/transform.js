import stream from 'stream'
import crypto from 'crypto'

const Transform = stream.Transform

class HashTransform extends Transform {
  constructor() {
    super()
    this.hashStream = crypto.createHash('sha256')
  }

  _transform(buf, enc, next) {
    this.hashStream.update(buf)
    this.push(buf)
    next()
  }

  getHash() {
    return this.hashStream.digest('hex')
  }
}

export default () => new HashTransform()