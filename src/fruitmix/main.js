import cluster from 'cluster'
import os from 'os'

import config from './cluster/config'

import Main from './cluster/main'
import Worker from './cluster/worker'

import IpcHandler from './cluster/ipcHandler'
import IpcWorker from './cluster/ipcWorker'

if (cluster.isMaster) {

  console.log(`Master ${process.pid} is running`)
  console.log(`CPU number ${numCPUs}`)

  const numCPUs = os.cpus().length

  for (let i = 0; i < numCPUs; i++) {
    let worker = cluster.fork()
    worker.on('message', msg => ipc.handle(worker, msg))
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`)
  })

  config.ipc = IpcHandler()
  Main()
} 
else {

  console.log(`Worker ${process.pid} started`);

  config.ipc = IpcWorker()
  Worker()
}


