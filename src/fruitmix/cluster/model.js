const path = require('path')
const fs = require('fs')

import config from './config'

const localUsers = callback => {
  let mpath = path.join(config.path, 'models', 'model.json')
  fs.readFile(mpath, (err, data) => {
    if (err) return callback(err)
    let model
    try {
      model = JSON.parse(data) 
    }
    catch(e) {
      return callback(e)
    }

    let users = model.users
    callback(null, users.filter(u => u.type === 'local'))
  })
}

module.exports = {
  localUsers
}

