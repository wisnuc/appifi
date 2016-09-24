var webpack = require('webpack')

var config = require('./backpack.config')

compiler = webpack(config)
compiler.run((err, stats) => {
  console.log(err || stats)
})
