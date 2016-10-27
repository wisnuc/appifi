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

const tryBoot = () => {

  let bootMode = sysconfig.get('bootMode')
  let lastFileSystem = sysconfig.get('lastFileSystem')
  let { blocks, volumes } = storeState().storage

  if (bootMode === 'maintenance') {

    debug('bootMode is set maintenance by user')
    return {
      state: 'maintenance',
      bootMode: 'maintenance',
      error: null,
      currentFileSystem: null,
      lastFileSystem
    }
  }

  // find all file systems, including unmounted, missing, etc.
  let fileSystems = [...blocks.filter(blk => blk.stats.isFileSystem && !blk.stats.isVolume),  
    ...volumes.filter(vol => vol.stats.isFileSystem)]

  debug('tryBoot: all file systems', fileSystems)

  if (lastFileSystem) {

    let last = fileSystems.find(fsys => 
      fsys.stats.fileSystemType === lastFileSystem.type &&
      fsys.stats.fileSystemUUID === lastFileSystem.uuid)

    if (last) {

      debug('last file system found', last)

      let error = null
      if (!last.stats.isMounted) {
        debug('last file system is not mounted')
        error = 'EMOUNTFAIL'
      }
      else if (last.stats.isVolume && last.stats.isMissing) {
        debug('last file system is volume and has missing device')
        error = 'EVOLUMEMISSING'
      }
      else if (!last.stats.wisnucInstalled) {
        debug('last file system has no wisnuc installed')
        error = 'EWISNUCNOTFOUND'
      }

      let state, currentFileSystem
      if (err) {
        state = 'maintenance',
        error,
        currentFileSystem = null 
      }
      else {
        debug('last file system ready to boot')
        state = 'normal',
        error,
        currentFileSystem = {
          type: last.stats.fileSystemType,
          uuid: last.stats.fileSystemUUID,
          mountpoint: last.stats.mountpoint
        }
      }

      return { state, bootMode, error, currentFileSystem, lastFileSystem }
    }
  }

  debug('no last fs in config or last fs not found')

  // no lfs or lfs not found, try alternative
  let alt = fileSystems.filter(fsys => fsys.stats.isMounted &&
    (fsys.stats.isVolume ? (!fsys.stats.isMissing) : true) &&
    fsys.stats.wisnucInstalled) 

  debug('alternatives', alt)

  if (alt.length === 1) {
    return {
      state: 'alternative',
      bootMode,
      error: null,
      currentFileSystem: {
        type: alt[0].stats.fileSystemType,
        uuid: alt[0].stats.fileSystemUUID,
        mountpoint: alt[0].stats.mountpoint
      },
      lastFileSystem
    }
  }
  else {
    return {
      state: 'maintenance',
      bootMode,
      error: alt.length === 0 ? 'ENOALT' : 'EMULTIALT',
      currentFileSystem: null,
      lastFileSystem
    }
  }
}

refreshStorage().asCallback(err => {

  if (err) {
    console.log('[app] failed to init storage, exit')
    console.log(err)
    process.exit(1) 
  }

  console.log('[app] updating sysboot', boot)

  let boot = tryBoot()
  if (boot.currentFileSystem) {

    console.log('boot current file system')

    appifiInit()
    createFruitmix(path.join(currentFileSystem.mountpoint, 'wisnuc', 'fruitmix'))
    sysconfig.set('lastFileSystem', currentFileSystem)
  }
  else {
    console.log('no current file system, boot into maintenance mode')
  }

  storeDispatch({ type: 'UPDATE_SYSBOOT', data: boot })
  startServer()
})


