const path = require('path')
const fs = require('fs')
const child = require('child_process')
const stream = require('stream')
const debug = require('debug')('append')

const script = `

const fs = require('fs')
const hash = require('crypto').createHash('sha256')


if (process.argv.length !== 2) process.exit(1)

let start = parseInt(process.argv[1])
let totalRead = 0
let written = -1

const Loop = () => {
  console.log('CHILD: creating readstream, start', start + totalRead)
  fs.createReadStream(null, { 
      fd: 4, 
      autoClose: false,
      start: start + totalRead 
    })
    .on('data', data => {
      hash.update(data)
      totalRead += data.length
      console.log('CHILD: read', data.length, totalRead)
    })
    .on('end', () => written === totalRead 
      ? process.send(hash.digest('hex'), () => process.exit())
      : setImmediate(Loop))
}

process.on('message', message => {
  console.log('CHILD: written', message)
  written = message
})

Loop()
`

class AppendStream extends stream.Writable {

  constructor(filePath) {
    super()

    // according to document, writable stream should NOT throw error
    this.error = undefined

    this.ws = fs.createWriteStream(filePath, { flags: 'a+' })
    this.ws.on('open', fd => {

      console.log('ws open', fd)

      fs.fstat(fd, (err, stat) => {

        console.log(stat)

        const opts = { stdio: ['ignore', 'inherit', 'ignore', 'ipc', fd] }
        this.child = child.spawn('node', ['-e', script, stat.size], opts)
        this.child.on('error', err => this.destroy(err))
        this.child.on('message', digest => {

          console.log('recv child message', digest)

          this.digest = digest
        })
        this.child.on('exit', (code, signal) => {
          console.log('exit', code, signal)
          this.finalCb()
        })
      })
    })

    this.ws.on('error', () => {
    })
  }

  _write (chunk, encoding, callback) {
    if (this.error) return callback(this.error)
    this.ws.write(chunk, encoding, () => callback())
  }

  _destroy (err, callback) {
    if (this.error) return callback(this.error)

    if (this.child) {
      // this.child.remove
    } 
  }

  _final (callback) {
    if (this.error) return callback(this.error)
    this.ws.end(() => {
      if (this.error) return callback(this.error)
      this.child.send(this.ws.bytesWritten)
      this.bytesWritten = this.ws.bytesWritten
      this.finalCb = callback
    }) 
  }
}

module.exports = AppendStream
