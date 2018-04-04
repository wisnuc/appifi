// must be executed before anything else in the whole app
// qiaoyun has tested that this value does not affect
// readdir performance significantly, at least for HDD (not SSD)
process.env['UV_THREADPOOL_SIZE'] = 64

const path = require('path')
const fs = require('fs')

// detect phi directory and set global variable accordingly
try {
  fs.readdirSync(path.join(__dirname, 'phi'))
  global.phi = true
} catch (e) {
  global.phi = false
}

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
const storage = require('./routes/storage')
const auth = require('./middleware/auth')
const token = require('./routes/token')
const users = require('./routes/users')
const drives = require('./routes/drives')
const ndrives = require('./routes/ndrives')
const boxes = require('./routes/boxes')
const media = require('./routes/media')
const tasks = require('./routes/tasks')
const cloudToken = require('./routes/wxtoken')
const station = require('./station')
const tags = require('./routes/tags')
const files = require('./routes/files')

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
app.use('/control/timedate', timedate)
if (barcelona.romcodes) app.use('/control/fan', barcelona.router)
app.use('/token', token)
app.use('/station', station)
app.use('/cloudToken', cloudToken)
app.use('/users', users)
app.use('/drives', drives)
app.use('/ndrives', ndrives)
app.use('/boxes', boxes)
app.use('/media', media)
app.use('/tasks', tasks)
app.use('/features', require('./routes/features'))
app.use('/download', require('./webtorrent'))
app.use('/tags', tags)
app.use('/files', files)

let { NODE_ENV, NODE_PATH, LOGE } = process.env
const isAutoTesting = NODE_ENV === 'test' && NODE_PATH !== undefined

// app.use('/uploads', uploads)
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handlers
app.use(function(err, req, res, next) {
  // if (err && process.env.NODE_ENV === 'test' && !NODE_PATH) console.log(err)

  if (err) {
    // FIXME: logger error 
    // console.error('error', err)

    if (isAutoTesting && !LOGE) {
    } else {
      console.log('::', err)
    }
  }

  res.status(err.status || 500).json({
    code: err.code,
    message: err.message,
    where: err.where
  })
})

if (NODE_PATH) app.nolog = true

if (!isAutoTesting) {
  let server = app.listen(3000, err => {
    if (err) {
      console.log('failed to listen on port 3000')
      process.exit(1)
    } else {
      console.log('server started on port 3000')
    }
  })

  server.on('error', err => console.log('WARNING: http server error', err))
  server.on('timeout', () => console.log('WARNING: http server timeout'))
  server.setTimeout(600 * 1000) // 10 minutes
}

module.exports = app

