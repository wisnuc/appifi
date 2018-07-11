const debug = require('debug')('dirstats')

class DirStats {
  constructor (vfs) {
    this.vfs = vfs
  }

  GET (user, props, callback) {
    this.vfs.DIRSTATS(user, props, callback)
  }
}

module.exports = DirStats
