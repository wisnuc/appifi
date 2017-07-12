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
const boxes = require('./routes/boxes')
const cloudToken = require('./routes/wxtoken')
const uploads = require('./routes/uploads')

let app = express()

if (process.env.NODE_ENV === 'test') app.nolog = true

app.use(logger('dev', { skip: (req, res) => res.nolog === true || app.nolog === true }))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(auth.init())
app.use('/token', token)
app.use('/users', users)
app.use('/drives', drives)
app.use('/boxes', boxes)
app.use('/cloudToken', cloudToken)
app.use('/uploads', uploads)

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

