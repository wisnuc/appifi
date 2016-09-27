var fs = require('fs')
var webpack = require('webpack')

module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: ['./assets.js'],
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
    "../build/Release/hash": `commonjs ./bin/xxhash.node`,
    "./build/Release/xattr": `commonjs ./bin/xattr.node`, 
  },

  module: {
    preLoaders: [
      { test: /\.json$/, loader: 'json' },
      { test: /\.node$/, loader: 'node' },
    ],

    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015', 'bluebird'],
          plugins: [
            "transform-async-to-bluebird", 
            "transform-promise-to-bluebird",
            "transform-runtime"
          ]
        }
      }
    ]
  },

  plugins: [
    new webpack.DefinePlugin({ "global.GENTLY": false }),
    new webpack.DefinePlugin({ "global.WEBPACK": true })
  ],
}

