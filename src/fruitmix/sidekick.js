const path = require('path')
const cluster = require('cluster')
const http = require('http')
const UUID = require('uuid')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

cluster.setupMaster({
  exec: path.join(__dirname, 'sidekick', 'worker'),
  args: ['--use', 'http'],
})

cluster.fork()
cluster.fork()

cluster.on('exit', (worker, code, signal) => {
  console.log('worker %d died (%s). restarting...', worker.process.pid, signal || code)
  setTimeout(() => cluster.fork(), 3000)
})

