import path from 'path'
import child from 'child_process'
import http from 'http'
import Debug from 'debug'
import sysinit from './system/sysinit'
import { storeDispatch } from './reducers'
import system from './system/index'
import app from './appifi/index'
import deviceProbe from './system/device'
import { tryBoot } from './system/boot'

const debug = Debug('system:bootstrap')
const port = 3000

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
    console.log('[app] Listening on port ' + httpServer.address().port)
  })

  httpServer.listen(port);
}

process.argv.forEach((val, index, array) => {
  if (val === '--appstore-master') {
    storeDispatch({
      type: 'SERVER_CONFIG',
      key: 'appstoreMaster',
      value: true
    })
  }
})

deviceProbe((err, data) => {

  if (!err)
    storeDispatch({
      type: 'UPDATE_DEVICE',
      data
    })

  tryBoot(err => {

    if (err) {
      console.log('[app] failed to boot')
      console.log('==== die ====')
      console.log(err)
      console.log('==== die ====')
      process.exit(1)
      return
    }

    startServer()
  })
})

