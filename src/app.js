var assets = require('../assets')
var path = require('path')
var express = require('express')
var logger = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')

let app = express()

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
import sysinit from './system/sysinit'
import { storeDispatch } from './appifi/lib/reducers'
import server from './appifi/lib/server'
import appstore from './appifi/lib/appstore'
import docker from './appifi/lib/docker'
import storage from './appifi/lib/storage'
import system from './system/index'

process.argv.forEach(function (val, index, array) {
  if (val === '--appstore-master') {
    storeDispatch({
      type: 'SERVER_CONFIG',
      key: 'appstoreMaster',
      value: true
    })
  }
});

storage.init()
docker.init()
appstore.reload()

app.set('json spaces', 2)

/*
 * routes
 */
// app.use('/', require('./appifi/routes/index'))

app.get('/', (req, res) => 
  res.set('Content-Type', 'text/html').send(assets.indexHtml))

app.get('/favicon.ico', (req, res) => 
  res.set('Content-Type', 'image/x-icon').send(assets.favicon))

app.get('/index.html', (req, res) => {
  res.set('Content-Type', 'text/html').send(assets.indexHtml)
})

app.get('/bundle.js', (req, res) => {
  res.set('Content-Type', 'application/javascript').send(assets.bundlejs)
})

app.use('/stylesheets', require('./appifi/routes/stylesheets'))
app.use('/appstore', require('./appifi/routes/appstore'))
app.use('/server', require('./appifi/routes/server'))
app.use('/system', system)

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
})


