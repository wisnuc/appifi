const fs = require('fs')

fs.open('testdata/alonzo_church.jpg', 'r', (err, fd) => {


  ;(function readLoop() {
    let buf = Buffer.alloc(1024 * 1024)
    fs.read(fd, buf, 0, 1024 * 1024, null, (err, bytesRead, buffer) => {
      if (err) return console.log(err)
      console.log('buf equal', buf === buffer)
      console.log('buf length', buf.length)
      console.log('buffer length', buffer.length)
      console.log('bytesRead', bytesRead)

      setImmediate(readLoop)
    })
  })()
})
