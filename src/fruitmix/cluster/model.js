const path = require('path')
const fs = require('fs')
// const nodeify = require('nodeify')

const config = require('./config')

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

