const fs = require('fs')
const webpack = require('webpack')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

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
    // "../build/Release/hash": `commonjs ./bin/xxhash.node`,
    "../build/Release/hash": `commonjs ./bin/xxhash.node`,
    "./build/Release/xattr": `commonjs ./bin/xattr.node`, 
    "./build/Release/bcrypt": `commonjs ./bin/bcrypt.node`,
    "./build/Release/crypt3": `commonjs ./bin/crypt3.node`,
    './build/Release/crypt3async': `commonjs ./bin/crypt3async.node`,
    'bcrypt': 'bcrypt',
    'ws': 'ws',
    'bindings': 'bindings',
    'colors': 'colors',
    'express': 'express'
  },

  module: {
    rules: [
      { test: /\.json$/, enforce: 'pre', loader: 'json-loader' },
      { test: /\.node$/, enforce: 'pre', loader: 'node-loader' },
      { test: /\.base64$/, loader: 'raw-loader' }
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
    new webpack.DefinePlugin({ "global.WEBPACK": true }),
    // new UglifyJSPlugin(),
  ],
}

