var util = require('util')
var diskprobe = require('./diskprobe')
var volumeprobe = require('./volumeprobe')
var mountprobe = require('./mountprobe')

/**
diskprobe( (error, results) => {
  console.log(JSON.stringify(results))
})

**/


volumeprobe( (error, results) => {
  console.log(error)
  console.log(JSON.stringify(results, null, '  '))
})

/**
mountprobe( (error, results) => {
  console.log(JSON.stringify(results))
})
**/
