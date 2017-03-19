import cluster from 'cluster'
import createIpcHandler from 'ipcHandler'
import createIpcWorker from 'ipcWorker'

const ipc = cluster.isMaster 
  ? createIpcHandler() 
  : createIpcWorker()

export default ipc

