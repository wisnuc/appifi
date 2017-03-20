import http from 'http'
import App from './app'
// import { createHttpServer } from '../fruitmix'

const createHttpServer = () => {

  let app = App()
  let server, port = 3721
  app.set('port', port)

  server = http.createServer(app)
  server.timeout = 24 * 3600 * 1000 // 24 hours

  server.on('error', error => {

    if (error.syscall !== 'listen') {
      throw error
    }

    // handle specific listen errors with friendly messages
    switch (error.code) {
    case 'EACCES':
      console.error('Port ' + port + ' requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error('Port ' + port + ' is already in use')
      process.exit(1)
      break
    default:
      throw error
    }
  })

  server.on('listening', () => {
    console.log('[fruitmix] Http Server Listening on Port ' + port)
  })

  server.on('close', () => console.log('[fruitmix] Http Server Closed'))

  server.listen(port)
}

export default createHttpServer
