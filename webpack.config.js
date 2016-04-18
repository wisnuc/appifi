console.log(__dirname)

module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: './web/index',
  output: {
    path: __dirname + '/public',
    filename: 'bundle.js'
  },

  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015', 'react', 'stage-0']
        }
      }
    ]
  },

  resolve: {
    moduleDirectories: [ 'node_modules'],
    extensions: ['', '.js', '.jsx']
  }
}
