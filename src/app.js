const path = require('path')
const fs = require('fs')
const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')

const broadcast = require('./common/broadcast')

const settings = require('./system/settings')

const app = express()

const config = require('./system/config')
const barcelona = require('./system/barcelona')
const system = require('./system/system')
const net = require('./system/net')
const timedate = require('./system/timedate')
const boot = require('./system/boot')
const storage = require('./system/storage')
const auth = require('./fruitmix/middleware/auth')
const token = require('./fruitmix/routes/token')
const users = require('./fruitmix/routes/users')
const drives = require('./fruitmix/routes/drives')
const boxes = require('./fruitmix/routes/boxes')
const wxtoken = require('./fruitmix/routes/wxtoken')
const uploads = require('./fruitmix/routes/uploads')

/**
This module is the entry point of the whole application.

@module App
*/


app.set('json spaces', 0)
app.use(logger('dev', { skip: (req, res) => res.nolog === true || app.nolog === true }))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(auth.init())
app.use('/boot', boot)
app.use('/storage', storage)
app.use('/control/system', system) 
app.use('/control/net/interfaces', net)
app.use('/control/timedata', timedate)
if (barcelona.isBarcelona) app.use('/control/fan', barcelona.router)
app.use('/token', token)
app.use('/users', users)
app.use('/drives', drives)
app.use('/boxes', boxes)
app.use('/wxtoken', wxtoken)
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

let { NODE_ENV, NODE_PATH } = process.env
const isAutoTesting = NODE_ENV === 'test' && NODE_PATH !== undefined

if (NODE_ENV === 'test') app.nolog = true

if (!isAutoTesting) {

  app.listen(3000, err => {

    if (err) {
      console.log('failed to listen on port 3000')
      return process.exit(1)
    }

    console.log('server started on port 3000')
  })
}

module.exports = app

