const fs = require('fs')
const stream = require('stream') 
const FormData = require('form-data')
const crypto = require('crypto')

class Trans extends stream.Transform {

  constructor(filePath, size) {
    super()
    this.size = 39499 
    this.hash = crypto.createHash('sha256')
  }

  opts() {
    return {
      filename: 'foo', 
      knownLength: 4 + 2
    }
  }

  _transform(chunk, encoding, callback) {

    this.hash.update(chunk, encoding)
    this.push(chunk)
    callback()
  }

  _flush(callback) {
    this.push('x')
    callback()
  }
}

let trans = new Trans()

let form = new FormData()

fs.createReadStream('testdata/foo').pipe(trans)

form.append('hello', 'world')
form.append('file', trans, trans.opts())

form.submit('http://localhost:12345', function(err, res) {
  console.log(err || res.body)
})


