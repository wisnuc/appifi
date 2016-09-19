import path from 'path'
import http from 'http'
import EventEmitter from 'events'
import Debug from 'debug'

import system from './lib/system'
import app from './app'

class Fruitmix extends EventEmitter {

  constructor() {
  }
}

const createFruitmix(sysroot, port) {
 
 
  system.init(sysroot)
  app.set('port', port)  
  
}


var port = normalizePort(process.env.PORT || '80')
app.set('port', port)

var server = http.createServer(app)
server.listen(port)
server.on('error', onError)
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port

  // handle specific listen errors with friendly messages
  switch (error.code) {
  case 'EACCES':
    console.error(bind + ' requires elevated privileges')
    process.exit(1)
    break
  case 'EADDRINUSE':
    console.error(bind + ' is already in use')
    process.exit(1)
    break
  default:
    throw error
  }
}
server.on('listening', onListening)
function onListening() {
  var addr = server.address()
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port
  debug('Listening on ' + bind)
}
server.timeout = 24 * 3600 * 1000 // 24 hours


