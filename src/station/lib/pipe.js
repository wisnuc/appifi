const { upload, download } = require('./request')
const Connect = require('./connect')
const broadcast = require('../../common/broadcast')
// const handleUpload = () => {
  
// }

// const handleDownload = () => {

// }

// module.exports = {
//   handleUpload,
//   handleDownload
// }

class Fetch {
  constructor() {

  }

  run() {

  }
}

class Store {
  constructor() {

  }

  run() {

  }
}


class Pipe{
  constructor() {
    broadcast.on('FruitmixStart', froot => this.froot = froot)
    broadcast.on('Connect_Connected', () => {
      Connect.register('pipe', this.handle.bind(this))
    })
  }

  handle(data) {
    if(data.type === 'fetch')
      return new Fetch(data.data)
    if(data.type === 'store')
      return new Store(data.data)
    throw new Error('PIPE Type not find!')
  }
}

module.exports = new Pipe()