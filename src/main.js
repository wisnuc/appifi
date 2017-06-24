const path = require('path')
const fs = require('fs')
const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')

const app = express()

const auth = require('./fruitmix/middleware/auth')

if (process.env.NODE_ENV === 'test') app.nolog = true

app.use(logger('dev', { skip: (req, res) => res.nolog === true || app.nolog === true }))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(auth.init())

app.use('system', require('./system'))
app.use('fruitmix', require('./fruitmix'))

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

