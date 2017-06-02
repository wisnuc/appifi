const cluster = require('cluster')
const http = require('http')
const UUID = require('uuid')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const app = require('./app')

const sockPath = '/tmp/sidekick'

if (cluster.isMaster) {

  cluster.fork()
  cluster.fork()  

  cluster.on('exit', (worker, code, signal) => {
    console.log('worker %d died (%s). restarting...', worker.process.pid, signal || code)
    // cluster.fork()
  })
}
else {

  console.log(`worker starting, pid ${process.pid}`)

  let server = http.createServer(app)

  server.listen(8964)
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log('Address in use, retrying...')
      setTimeout(() => {
        server.close()
        server.listen(8964)
      }, 5000)
    }
  })

  process.on('SIGTERM', () => server.close())
  process.on('uncaughtException', () => server.close())
}


