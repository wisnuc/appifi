import path from 'path'
import http from 'http'
import dgram from 'dgram'
import EventEmitter from 'events'
import Debug from 'debug'
import system from './lib/system'
import models from './models/models'
import app from './app'
import { createSmbAudit } from './lib/samba'

const debug = Debug('fruitmix:createFruitmix')

class Fruitmix extends EventEmitter {

  constructor(system, app, server, udp) {

    super()

    this.system = system
    this.app = app
    this.server = server 
    // this.udp = udp
  }

  stop() {
    this.server.close()
    // this.udp.close()
    this.system.deinit()
  }
}

const createFruitmix = (sysroot) => {

  debug(sysroot)

  let server, port = 3721 

  system.init(sysroot)
  app.set('port', port)

  server = http.createServer(app)
  server.timeout = 24 * 3600 * 1000 // 24 hours

  server.on('error', error => {

    if (error.syscall !== 'listen') {
      throw error
    }

    // handle specific listen errors with friendly messages
    switch (error.code) {
    case 'EACCES':
      console.error('Port ' + port + ' requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error('Port ' + port + ' is already in use')
      process.exit(1)
      break
    default:
      throw error
    }
  })

/**
  server.on('listening', () => debug('Http Server Listening on Port ' + port))
  server.on('close', () => debug('Http Server Closed'))

  server.listen(port)

  let udp = dgram.createSocket('udp4')
    
  udp.on('listening', () => {
    var address = udp.address();
    debug('UDP Server listening on ' + address.address + ":" + address.port)
  })

  udp.on('message', function (message, remote) {
    debug(remote.address + ':' + remote.port + ' - ' + message)
  })

  udp.on('close', () => debug('UDP Server closed'))

  udp.bind(port)
**/

  let smbaudit = createSmbAudit(err => {
    console.log('smb audit created') 
  })

  return new Fruitmix(system, app, server)
}

export { createFruitmix }

