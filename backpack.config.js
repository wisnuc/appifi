
module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: ['./src/app'],
  node: {
    __filename: false,
    __dirname: false,
  },
  target: 'node',
  output: {
    path: __dirname,
    publicPath: 'bin/',
    filename: 'appifi.js'
  },

  module: {
    preloaders: [
      { test: /\.node$/, loader: 'node-loader' },
      { test: /\.json$/, loader: 'json-loader' },
    ],

    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: ['babel'],
        query: {
          presets: ['es2015', 'bluebird'],
          plugins: [
            "transform-async-to-bluebird", 
            "transform-promise-to-bluebird",
            "transform-runtime"]
        }
      },
    ]
  },
}

