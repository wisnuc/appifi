const fs = require('fs')
const broadcast = require('../../../common/broadcast')


class GlobalInfo {
  constructor() {
    broadcast.on('StaionStart', station => {
      // this.init(station.)
    })
  }

  init(froot) {
    
  }

  deinit() {

  }
}