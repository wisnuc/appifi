import http from 'http'
import cluster from 'cluster'
import os from 'os'

import ipcMain from './lib/ipcMain'
import { createFruitmix } from './fruitmix'

if (cluster.isMaster) {
  // init data source
  // maybe sysroot from child_process.fork option
  createFruitmix(process.env.sysroot)

  //start ipc
  ipcMain.start()

  cluster.setupMaster({exec:'fruitmix_worker.js'})
  //create workers
  os.cpus().forEach(() => cluster.fork())

  // on worker events
}