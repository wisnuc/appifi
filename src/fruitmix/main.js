import path from 'path'
import cluster from 'cluster'
import os from 'os'

import config from './cluster/config'

import Main from './cluster/main'
import Worker from './cluster/worker'

import IpcHandler from './cluster/ipcHandler'
import IpcWorker from './cluster/ipcWorker'

// check fruitmix path
if (typeof config.path !== 'string' || config.path.length === 0) {
  console.log('fruitmix root path not set')
  process.exit(1)
}
else if (!path.isAbsolute(config.path)) {
  try {
    config.path = path.resolve(config.path)
  }
  catch (e) {
    console.log('failed to resolve fruitmix path')
    process.exit(1)
  }
}

if (cluster.isMaster) {

  console.log(`Master ${process.pid} is running`)
  console.log(`fruitmix path is set to ${config.path}`)

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


