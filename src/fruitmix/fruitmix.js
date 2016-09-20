import path from 'path'
import http from 'http'
import EventEmitter from 'events'
import Debug from 'debug'

import system from './lib/system'
import models from './models/models'
import app from './app'

let debug = Debug('fruitmix')

class Fruitmix extends EventEmitter {

  constructor(system, app, server, port) {
    super()

    this.system = system
    this.app = app
    this.server = server 
    this.port = port

    let umod = models.getModel('user')
    umod.on('smbChange', console.log('smbChanged from user model'))
  }

  stop() {
    this.server.close()
    this.system.deinit()
  }
}

const createFruitmix = (sysroot) => {

  console.log('creating fruitmix')

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

  server.on('listening', () => debug('Listening on Port ' + port))
  server.listen(port)

  debug('fruitmix created')
  return new Fruitmix(system, app, server, port)
}

export { createFruitmix }

