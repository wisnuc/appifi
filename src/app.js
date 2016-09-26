var path = require('path')
var express = require('express')
// var favicon = require('serve-favicon')
var logger = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')

let app = express()

/*
 * middlewares
 */
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev', {
  skip: (req) => {
    // console.log(`morgan: ${req.path}`)
    if (req.path === '/status') return true
    return false
  }
}))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

/*
 * module init
 */
import { storeDispatch } from './appifi/lib/reducers'
import { initConfig, getConfig } from './appifi/lib/appifiConfig'
import { setFanScale, updateFanSpeed, pollingPowerButton } from './appifi/lib/barcelona'
import server from './appifi/lib/server'
import appstore from './appifi/lib/appstore'
import docker from './appifi/lib/docker'
import storage from './appifi/lib/storage'

process.argv.forEach(function (val, index, array) {
  if (val === '--appstore-master') {
    storeDispatch({
      type: 'SERVER_CONFIG',
      key: 'appstoreMaster',
      value: true
    })
  }
});

initConfig()

// code for barcelona, harmless for other platfrom
updateFanSpeed()
pollingPowerButton()
setFanScale(getConfig('barcelonaFanScale'))

storage.init()
docker.init()
appstore.reload()

/*
 * routes
 */
// app.use('/', require('./appifi/routes/index'))

app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html').send(assets.indexHtml)
})

app.get('/index.html', (req, res) => {
  res.set('Content-Type', 'text/html').send(assets.indexHtml)
})

app.get('/bundle.js', (req, res) => {
  res.set('Content-Type', 'application/javascript').send(assets.bundlejs)
})

app.use('/stylesheets', require('./appifi/routes/stylesheets'))
app.use('/appstore', require('./appifi/routes/appstore'))
app.use('/server', require('./appifi/routes/server'))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res) {
    res.status(err.status || 500)
    res.send('error: ' + err.message)
  })
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res) {
  res.status(err.status || 500)
  res.send('error: ' + err.message)
})

// module.exports = app

/**
 * Module dependencies.
 */

// var app = require('../app');
var debug = require('debug')('appifi:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var httpServer = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

httpServer.listen(port);
httpServer.on('error', onError);
httpServer.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = httpServer.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
})


