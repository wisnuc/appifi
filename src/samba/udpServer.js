let dgram = require('dgram')
let SmbAudit = require('./sambaAudit')

const defaultPort = 3721

const createUdpServer = (callback) => {

  let udp = dgram.createSocket('udp4')
  
  udp.on('listening', () => {
    callback(null, new SmbAudit(udp))
  }) 
 
  udp.once('error', err => {
    if (err.code === 'EADDRINUSE') {
      callback(err)
    }
  })

  udp.bind(defaultPort)
}

module.exports = createUdpServer