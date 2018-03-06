const Promise = require('bluebird')
const fs = require('fs')
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const child = require('child_process')

const createFile = (filePath, size, seed, callback) => {

  const mega = 1024 * 1024
  const unit = Buffer.from(crypto.createHash('sha256').update(seed).digest('hex'), 'utf8')  // 64 byte
  const buffer = Buffer.concat(new Array(16 * 1024).fill(unit))                             // 1MB, 1048576

  if (buffer.length !== 1048576) {
    console.log('error buffer length', buffer.length)
    process.exit(1)
  }

  let bytesWritten = 0
  let error

  let ws = fs.createWriteStream(filePath)
  ws.on('error', err => {
    if (error) return
    error = err
    ws.end()
    callback(err)
  })

  ws.on('finish', () => {
    if (error) return
    fs.open(filePath, 'r+', (err, fd) => {
      if (err) return callback(err)
      fs.ftruncate(fd, size, err => {
        fs.close(fd, x => x)
        if (err) {
          return callback(err)
        } else {
          return callback(null)
        }
      })    
    })
  })

  const Loop = () => {
    if (error) return
    if (bytesWritten >= size) {
      ws.end()
    } else {
      ws.write(buffer)
      bytesWritten += mega
      setImmediate(Loop)
    }
  }

  Loop()
}

module.exports = createFile

if (process.argv.includes('--standalone')) {

  let arg = process.argv.find(x => x.startsWith('--size='))
  if (!arg) {
    console.log('--size=<number> expected')
    process.exit(1)
  }

  let size = parseInt(arg.slice('--size='.length))
  if (!Number.isInteger(size) || size < 0) {
    console.log('--size=<number> expected')
    process.exit(1)
  }

  mkdirp.sync('tmptest')

  createFile('tmptest/testBigFile', size, '', err => {
    if (err) return console.log(err)
    child.exec('ls -sail tmptest/testBigFile', (err, stdout, stderr) => {
      if (err) return console.log(err)
      console.log(`expected size: ${size}`)
      console.log(stdout)
    })
  })
}

