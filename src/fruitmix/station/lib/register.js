const fs = require('fs')
const path = require('path')

const Promise = require('bluebird')

const request = require('superagent')
// const Promise = require('bluebird')

const { FILE, CONFIG } = require('./const')

// Promise.promisifyAll(fs)

let register = (froot, callback) => {
  let saPath = path.join(froot, 'station', FILE.SA)
  fs.lstat(saPath, (err, lstat) => {
    if(err || !lstat.isFile()) return requestRegisterStation(froot, callback)
    fs.readFile(saPath, (err, data) => {
      if(err) return callback(err)
      return callback(null, JSON.parse(data))
    })
  })
}

let registerAsync = Promise.promisify(register)

let requestRegisterStation = (froot, callback) => {
  let publicKey = fs.readFileSync(path.join(froot, 'station', FILE.PUBKEY)).toString('utf8')
  // console.log(publicKey)
  request
    .post(CONFIG.CLOUD_PATH + 'v1/stations')
    .set('Content-Type', 'application/json')
    .send({
       publicKey
    })
    .end((err, res) => {
      let SA_PATH = path.join(froot, 'station', FILE.SA)
      if(err || res.status !== 200) return callback(new Error('register error')) 
      let ws = fs.createWriteStream(SA_PATH)
      ws.write(JSON.stringify(res.body.data, null, ' '))
      ws.close()
      return callback(null, res.body.data)
    }) 
}

module.exports = {
  register,
  registerAsync
}