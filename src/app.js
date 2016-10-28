import path from 'path'
import http from 'http'
import Debug from 'debug'
const debug = Debug('system:bootstrap')

import sysinit from './system/sysinit'
import sysconfig from './system/sysconfig'
import { storeState, storeDispatch } from './appifi/lib/reducers'
import storage from './appifi/lib/storage'
import { refreshStorage, mountedFS } from './appifi/lib/storage'
import system from './system/index'
import appifiInit from './appifi/appifi'
import app from './appifi/index'
import { createFruitmix } from './fruitmix/fruitmix'
import { tryBoot } from './system/boot'

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

tryBoot(err => err ? process.exit(1) : startServer())


