import stream from 'stream'
import crypto from 'crypto'

const Transform = stream.Transform

class HashTransform extends Transform {
  constructor() {
    super()
    this.hashStream = crypto.createHash('sha256')
    this.hashStream.setEncoding('hex')
  }

  _transform(buf, enc, next) {
    console.log(buf)
    this.hashStream.update(buf)
    this.push(buf)
    next()
  }

  getHash() {
    return this.hashStream.read()
  }
}

export default () => new HashTransform()