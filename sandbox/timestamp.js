const fs = require('fs')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

rimraf.sync('tmptest/hello')

mkdirp('tmptest/hello', err => {
  fs.stat('tmptest/hello', (err, stat1) => {
    console.log(stat1.ctimeMs) 
    mkdirp('tmptest/hello/world', err => {
      fs.stat('tmptest/hello', (err, stat2) => {
        console.log(stat2.ctimeMs)
        fs.stat('tmptest/hello', (err, stat3) => {
          console.log(stat3.ctimeMs)
          setTimeout(() => 
          fs.stat('tmptest/hello', (err, stat3) => {
            console.log(stat3.ctimeMs)
          }), 100)
        })
      })
    })
  })
})
