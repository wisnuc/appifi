import path from 'path'
// import child from 'child_process'
import http from 'http'
import dgram from 'dgram'
// import EventEmitter from 'events'

import Debug from 'debug'
import { storeState, storeDispatch } from '../reducers'
import system from './lib/system'
import models from './models/models'
import app from './app'
// import { createSmbAudit } from './lib/samba'

const debug = Debug('fruitmix:fruitmix')

// Promise.promisifyAll(child)

// const startSamba = async () => {
//   child.execAsync('systemctl start nmbd'),
//   child.execAsync('systemctl start smbd')
// }

// class Fruitmix extends EventEmitter {

//   constructor(system, app, server, smbAudit) {

//     super()
//     this.system = system
//     this.app = app
//     this.server = server 
//     this.smbAudit = smbAudit
//   }
// }

// TODO
const createHttpServer = (app, callback) => {

  let server, port = 3721
  app.set('port', port)

  server = http.createServer(app)
  server.timeout = 24 * 3600 * 1000 // 24 hours

  server.on('error', error => {

    if (error.syscall !== 'listen') {
      throw error
    }

    // handle specific listen errors with friendly messages
    switch (error.code) {
    case 'EACCES':
      console.error('Port ' + port + ' requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error('Port ' + port + ' is already in use')
      process.exit(1)
      break
    default:
      throw error
    }
  })

  server.on('listening', () => {
    console.log('[fruitmix] Http Server Listening on Port ' + port)
    callback()
  })
  server.on('close', () => console.log('[fruitmix] Http Server Closed'))
  server.listen(port)
}

const createFruitmixAsync = async (sysroot) => {

  await system.initAsync(sysroot)
  // let server = await Promise.promisify(createHttpServer)()
  // let smbaudit = await Promise.promisify(createSmbAudit)()
  // return new Fruitmix(system, app, null, smbaudit)
}

const createFruitmix = (sysroot, callback) => createFruitmixAsync(sysroot).asCallback(err => callback && callback(err))

export { createFruitmix, createHttpServer }

