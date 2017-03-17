import http from 'http'
import cluster from 'cluster'

import ipcWorker from '../lib/ipcWorker'
import app from '../app'
import { createHttpServer } from '../fruitmix'

if(cluster.isWorker){
  //start ipc
  ipcWorker.start()
  let froot = process.argv.froot
  app.froot = froot
  //create sever
  createHttpServer(app, () => console.log('fruitmix worker:' + cluster.worker.id + ' PID: ' + process.pid + ' start on port :' + app.get('port')))
}