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

refreshStorage().asCallback(err => {

  if (err) {
    console.log('failed to init storage, exit')
    console.log(err)
    process.exit(1) 
  }

  let fileSystem = null
  let mountpoint = null

  // load config
  let lastFileSystem = sysconfig.get('lastFileSystem') 

  debug('sysconfig', sysconfig)
  debug('lastFileSystem', lastFileSystem)

  let state
  let currentFileSystem = null
  let bootMode = sysconfig.get('bootMode')
  debug('bootMode', bootMode)

  if (bootMode === 'maintenance') {
    // enter maintenance mode by user setting
    state = 'maintenance'
    // clear one-shot config
    sysconfig.set('bootMode', 'normal')
  }
  else { // normal mode

    // find all file system mounted
    let mounted = mountedFS(storeState().storage)

    if (lastFileSystem) {

      fileSystem = mounted.find(x => 
        x.stats.fileSystemType === lastFileSystem.type &&
        x.stats.fileSystemUUID === lastFileSystem.uuid)

      if (fileSystem) debug('lastFileSystem found', fileSystem)
    }

    if (fileSystem) { // fileSystem found
      
    }
    else { // no lastFileSystem or corresponding file system not found

      let installed = mounted.filter(mfs => mfs.stats.wisnucInstalled)
      if (installed.length == 1) { // only one
        fileSystem = installed[0]
      }
    }

    // Not checked ... TODO
    if (fileSystem) {

      state = 'normal'
      currentFileSystem = {
        type: fileSystem.stats.fileSystemType,
        uuid: fileSystem.stats.fileSystemUUID,
        mountpoint: fileSystem.stats.mountpoint
      }

      debug('set currentFileSystem', fileSystem, currentFileSystem)

      appifiInit()
      createFruitmix(path.join(currentFileSystem.mountpoint, 'wisnuc', 'fruitmix'))
      sysconfig.set('lastFileSystem', currentFileSystem)

    }
    else {
      
      state = 'maintenance'
    }
  }

  // update store state
  let actionData = {
    state, 
    bootMode, 
    lastFileSystem, 
    currentFileSystem
  }
  storeDispatch({ type: 'UPDATE_SYSBOOT', data: actionData })

  // log
  console.log('[app] updating sysboot', actionData)

  startServer()
})


