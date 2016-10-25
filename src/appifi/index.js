var assets = require('../../assets')

var path = require('path')
var express = require('express')
var logger = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')

let app = express()

app.use(logger('dev', { 
  skip: (req, res) => res.nolog === true 
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
app.use((req, res, next) => next(Object.assign(new Error('Not Found'), { status: 404 })))

// development error handler will print stacktrace
(app.get('env') === 'development') && 
  app.use((err, req, res) => res.status(err.status || 500).send('error: ' + err.message))

// production error handler no stacktraces leaked to user
app.use((err, req, res) => 
  res.status(err.status || 500).send('error: ' + err.message))

var debug = require('debug')('appifi:server');
var http = require('http');

var port = 3000
app.set('port', port);

var httpServer = http.createServer(app);

httpServer.on('error', error => {
  if (error.syscall !== 'listen') 
    throw error;

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
})

httpServer.on('listening', () => 
  debug('Listening on port ' + httpServer.address().port))

httpServer.listen(port);

export default app
