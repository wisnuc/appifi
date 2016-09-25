var fs = require('fs')
var webpack = require('webpack')

module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: ['./build/app'],
  node: {
    __filename: false,
    __dirname: false,
  },

  target: 'node',

  output: {
    path: __dirname,
    filename: 'appifi.js'
  },

  externals: { 
//    "body-parser": "commonjs body-parser",
//    "express": "commonjs express",
    "fs-xattr": "commonjs fs-xattr",
    "xxhash": "commonjs xxhash"
  },

  module: {
    preLoaders: [
      { test: /\.json$/, loader: 'json' },
      { test: /\.node$/, loader: 'node' },
    ],
  },

  plugins: [
    new webpack.DefinePlugin({ "global.GENTLY": false })
  ],
}

