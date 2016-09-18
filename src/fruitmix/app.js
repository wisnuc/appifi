import path from 'path'
import fs from 'fs'

import Promise from 'bluebird'
import express from 'express'
import favicon from 'serve-favicon'
import logger from 'morgan'
import bodyParser from 'body-parser'

import auth from './middleware/auth'
import init from './routes/init'
import users from './routes/users'
import login from './routes/login'
import files from './routes/files'
import share from './routes/share'
import drives from './routes/drives'
import libraries from './routes/libraries'
import media from './routes/media'
import mediashare from './routes/mediashare'

let app = express()

let env = app.get('env')
if (env !== 'production' && env !== 'development' && env !== 'test') {
  console.log('Unrecognized NODE_ENV string: ' + env +', exit')
  process.exit(1)
} else {
  console.log('NODE_ENV is set to ' + env)
}

// TODO: logger should be moved to main
if (env !== 'test') app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(auth.init())

app.use(express.static(path.join(__dirname, 'public')))
app.use('/init', init)
app.use('/login', login)

app.use('/token', require('./routes/token'))

app.use('/users', users)

app.use('/libraries', libraries)
app.use('/drives', drives)
app.use('/files', files)
app.use('/share', share)
app.use('/media', media)
app.use('/mediashare', mediashare)

app.use('/authtest', require('./routes/authtest'))
// app.use('/library', require('./routes/library'))
// app.use('/mediashare', require('./routes/mediashare'))

// app.use(multer({ dest:'/data/fruitmix/files' }).any())

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handlers
app.use(function(err, req, res, next) {
  res.status(err.status || 500)
  res.type('text/plain')
  res.send(err.status + ' ' + err.message)
})

module.exports = app

