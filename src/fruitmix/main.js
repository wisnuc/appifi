import http from 'http'
import cluster from 'cluster'
import os from 'os'

import ipcMain from './lib/ipcMain'
import ipcWorker from './lib/ipcWorker'
import app from './app'
import { createFruitmix, createHttpServer } from './fruitmix'

if (cluster.isMaster) {
  // init data source
  // sysroot from child_process.fork option
  createFruitmix(process.env.sysroot)

  //create workers
  os.cpus().forEach(() => cluster.fork())

  //start ipc
  ipcMain.start()

}else if(cluster.isWorker){
  //start ipc
  ipcWorker.start()
  
  //create sever
  createHttpServer(app, () => console.log('fruitmix worker:' + cluster.worker.id + ' PID: ' + process.pid + ' start on port :' + app.get('port')))
}
