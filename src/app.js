import http from 'http'
import Debug from 'debug'
const debug = Debug('system:bootstrap')

import sysinit from './system/sysinit'
import sysconfig from './system/sysconfig'
import { storeState, storeDispatch } from './appifi/lib/reducers'
import storage from './appifi/lib/storage'
import { refreshStorage, mountedFS } from './appifi/lib/storage'
import system from './system/index'
import app from './appifi/index'

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

  httpServer.on('listening', () => 
    debug('Listening on port ' + httpServer.address().port))

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

refreshStorage().asCallback(err => {

  if (err) {
    console.log('failed to init storage, exit')
    console.log(err)
    process.exit(1) 
  }

  let fileSystem = null
  let mountpoint = null
  let lastFileSystem = sysconfig.get('lastFileSystem') 
  debug('sysconfig', sysconfig)
  debug('lastFileSystem', lastFileSystem)

  let bootMode = sysconfig.get('bootMode')
  debug('bootMode', bootMode)

  if (bootMode === 'normal') {

    let installed = mountedFS(storeState().storage)
      .filter(x => x.stats.wisnucInstalled)

    debug('installed', installed)

    if (lastFileSystem) {

      fileSystem = installed.find(x => 
        x.stats.fileSystemType === lastFileSystem.type &&
        x.stats.fileSystemUUID === lastFileSystem.uuid)

      if (fileSystem) debug('lastFileSystem found', fileSystem)
    }

    if (!fileSystem && installed.length === 1) {
      fileSystem = installed[0]
      debug('fileSystem set to the only choice', fileSystem)
    }
  }

  let currentFileSystem = null
  if (fileSystem) {

    currentFileSystem = {
      type: fileSystem.stats.fileSystemType,
      uuid: fileSystem.stats.fileSystemUUID
    }

    debug('set currentFileSystem', fileSystem, currentFileSystem)
  }

  storeDispatch({
    type: 'UPDATE_SYSBOOT',
    data: { 
      bootMode, 
      lastFileSystem,
      currentFileSystem,
      mountpoint: fileSystem ? fileSystem.stats.mountpoint : null,
    }
  })

  sysconfig.set('lastFileSystem', currentFileSystem)
  if (bootMode === 'maintenance')
    sysconfig.set('bootMode', 'normal')

  if (fileSystem) {
    // start appifi 
    // start samba
    // start appstore
    // start fruitmix
  }

  startServer()  
})


