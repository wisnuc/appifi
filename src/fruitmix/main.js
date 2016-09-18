var path = require('path')
var debug = require('debug')('server')
var http = require('http')
var system = require('./lib/system').default
var family = require('./util/family')
var app = require('./app')

var opt = process.argv[2]
var familyPath

if (opt === '--family') {

  familyPath = path.join(process.cwd(), 'family')
  family.initFamilyRoot(familyPath).asCallback(err => {
    if (err) return callback(err)
    system.init(familyPath, err => {
      if (err) {
        console.log(err)
        console.log('fatal error')
        return process.exit(1)
      }
      console.log('fruitmix initialized with family')
    })
  })
}
else {

  familyPath = opt
  system.init(familyPath, err => 
    err ? console.log(err) : console.log('fruitmix init'))
}

var port = normalizePort(process.env.PORT || '80')
app.set('port', port)

var server = http.createServer(app)
server.listen(port)
server.on('error', onError)
server.on('listening', onListening)
server.timeout = 100000000000

function normalizePort(val) {
  var port = parseInt(val, 10)

  if (isNaN(port)) {
    // named pipe
    return val
  }

  if (port >= 0) {
    // port number
    return port
  }

  return false
}

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

function onListening() {
  var addr = server.address()
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port
  debug('Listening on ' + bind)
}
