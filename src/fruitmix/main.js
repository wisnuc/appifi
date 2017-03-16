import http from 'http'
import cluster from 'cluster'
import os from 'os'
import ipcMain from './lib/ipcMain'
import ipcWorker from './lib/ipcWorker'

if (cluster.isMaster) {
  // init data source

  //create workers
  os.cpus().forEach(() => cluster.fork())

  //start ipc
  ipcMain.start()

}else if(cluster.isWorker){
  //start ipc
  ipcWorker.start()
  //create sever
  
}
