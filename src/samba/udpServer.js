const dgram = require('dgram')
const SmbAudit = require('./sambaAudit')
const DEFAULT_PORT = require('./config').DEFAULT_PORT

const Debug = require('debug')
const UDP_SERVER = Debug('SAMBA:UDP_SERVER')

const createUdpServer = (callback) => {

  let udp = dgram.createSocket('udp4')

  udp.on('listening', () => {
    UDP_SERVER('Got message')
    callback(null, new SmbAudit(udp))
  })

  udp.once('error', err => {
    if (err.code === 'EADDRINUSE') {
      UDP_SERVER('Something wrong')
      callback(err)
    }
  })

  udp.bind(DEFAULT_PORT)
}

module.exports = createUdpServer
