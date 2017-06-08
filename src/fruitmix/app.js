const path = require('path')
const fs = require('fs')
const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')

// require('./sidekick/sidekick')

const auth = require('./middleware/auth')
const token = require('./routes/token')
const users = require('./routes/users')
const drives = require('./routes/drives')
// const files = require('./routes/files')
const boxes = require('./routes/boxes')

/**
import init from './routes/init'
import login from './routes/login'
import files from './routes/files'
import meta from './routes/meta'
import share from './routes/share'
import drives from './routes/drives'
import libraries from './routes/libraries'
import media from './routes/media'
import mediashare from './routes/mediashare'
**/

let app = express()

if (process.env.NODE_ENV === 'test') app.nolog = true

app.use(logger('dev', { skip: (req, res) => res.nolog === true || app.nolog === true }))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(auth.init())
app.use('/token', token)
app.use('/users', users)
app.use('/drives', drives)
// app.use('/files', files)
app.use('/boxes', boxes)

/**
app.use('/init', init)
app.use('/login', login)

app.use('/token', require('./routes/token'))

app.use('/libraries', libraries)
app.use('/drives', drives)
app.use('/files', files)
app.use('/meta', meta)
app.use('/share', share)
app.use('/media', media)
app.use('/mediashare', mediashare)
app.use('/authtest', require('./routes/authtest'))
**/

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handlers
app.use(function(err, req, res, next) {

  if (err && process.env.NODE_ENV === 'test')
    console.log(err)

  res.status(err.status || 500)
  res.type('text/plain')
  res.send(err.status + ' ' + err.message)
})

module.exports = app

