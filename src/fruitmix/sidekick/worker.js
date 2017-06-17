const path = require('path')
const http = require('http')
const app = require('./app')

console.log(`worker starting, pid ${process.pid}`)

let server = http.createServer(app)
server.listen(4005, 'localhost')
server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.log('Address in use, retrying...')
    setTimeout(() => {
      server.close()
      server.listen(4005, 'localhost')
    }, 5000)
  }
})

process.on('SIGTERM', () => server.close())
process.on('uncaughtException', () => server.close())

