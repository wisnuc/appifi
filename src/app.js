import path from 'path'
import fs from 'fs'
import child from 'child_process'
import http from 'http'
import Debug from 'debug'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'

import { storeState, storeDispatch, storeSubscribe } from './reducers'
import { writeObjectAsync } from './common/async'
import system from './system/index'
import app from './appifi/index'
import deviceProbe from './system/device'
import { barcelonaInit } from './system/barcelona'
import { tryBoot } from './system/boot'

const debug = Debug('system:bootstrap')

const port = 3000
const wisnucTmpDir = '/etc/wisnuc/tmp'
const wisnucConfigFile = '/etc/wisnuc.json'

const initConfig = () => {

  let state = undefined

  storeSubscribe(() => {

    if (state === storeState().config) return

    state = storeState().config
    writeObjectAsync(wisnucConfigFile, wisnucTmpDir, state)
      .asCallback(err => {
        debug(`new config written`, state)
        if (err) console.log(`error writing config`, err, state)
      })
  })

  rimraf.sync(wisnucTmpDir)
  mkdirp.sync(wisnucTmpDir)

  let raw = null
  try {
    raw = fs.readFileSync(wisnucConfigFile, { encoding: 'utf8' }) 
  }
  catch (e) {
    console.log(e)
  }

  storeDispatch({
    type: 'CONFIG_INIT',
    data: raw
  })
  console.log('[bootstrap] config initialized')
  console.log(storeState().config)
}

// append (piggyback) system api
const startServer = () => {

  app.use('/system', system)

  // catch 404 and forward to error handler
  app.use((req, res, next) => next(Object.assign(new Error('Not Found'), { status: 404 })))

  // development error handler will print stacktrace
  if (app.get('env') === 'development') {
    app.use((err, req, res) => res.status(err.status || 500).send('error: ' + err.message))
  }

  // production error handler no stacktraces leaked to user
  app.use((err, req, res) => 
    res.status(err.status || 500).send('error: ' + err.message))

  app.set('port', port);

  const httpServer = http.createServer(app);

  httpServer.on('error', error => {

    if (error.syscall !== 'listen') throw error;
    switch (error.code) {
      case 'EACCES':
        console.error(`Port ${port} requires elevated privileges`)
        process.exit(1)
        break
      case 'EADDRINUSE':
        console.error(`Port ${port} is already in use`)
        process.exit(1)
        break
      default:
        throw error
    }
  })

  httpServer.on('listening', () => {
    console.log('[bootstrap] Listening on port ' + httpServer.address().port)
  })

  httpServer.listen(port);
}

process.argv.forEach((val, index, array) => {

  debug('argv index, value', index, val)

  if (val === '--no-fruitmix') {
    storeDispatch({
      type: 'DEVELOPER_SETTING',
      key: 'noFruitmix',
      value: true
    })
  }

  if (val === '--appstore-master') {
    storeDispatch({
      type: 'DEVELOPER_SETTING',
      key: 'appstoreMaster',
      value: true
    })
  }
})

// initialize config
initConfig()

deviceProbe((err, data) => {

  if (!err) {
    storeDispatch({
      type: 'UPDATE_DEVICE',
      data
    })

    if (data.ws215i) {
      console.log('[bootstrap] device is ws215i')
      barcelonaInit()
    }
    else {
      console.log('[bootstrap] device is not ws215i')
    }
  }

  tryBoot(err => {

    if (err) {
      console.log('[bootstrap] failed to boot')
      console.log('==== die ====')
      console.log(err)
      console.log('==== die ====')
      process.exit(1)
      return
    }

    startServer()
  })
})

