var express = require('express')
var path = require('path')
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
app.use(express.static(path.join(__dirname, 'public')))

/*
 * module init
 */ 
import server from 'lib/server'
import appstore from 'lib/appstore'
import docker from 'lib/docker'
import storage from 'lib/storage'

storage.init()
docker.init()
appstore.init()

/*
 * routes
 */
app.use('/', require('routes/index'))
app.use('/storage', require('routes/storage'))
app.use('/docker', require('routes/docker'))
app.use('/appstore', require('routes/appstore'))
app.use('/server', require('routes/server'))

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

module.exports = app

