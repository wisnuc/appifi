import http from 'http'
import app from '../../lib/router'

import Debug from 'debug'
const HTTP_SERVER = Debug('APPIFI:HTTP_SERVER')

const port = 3720

// inject (piggyback) appifi api
const httpServer = () => {

  //app.use('/appifi', appifi)

  // catch 404 and forward to error handler
  app.use((req, res, next) => next(Object.assign(new Error('Not Found'), { status: 404 })))

  // development error handler will print stacktrace
  if (app.get('env') === 'development') {
    app.use((err, req, res) => res.status(err.status || 500).send('error: ' + err.message))
  }

  // production error handler no stacktraces leaked to user
  app.use((err, req, res) => res.status(err.status || 500).send('error: ' + err.message))

  app.set('port', port)

  const httpServer = http.createServer(app)

  httpServer.on('error', error => {

    if (error.syscall !== 'listen') throw error
    switch (error.code) {
      case 'EACCES':
        HTTPSERVER(`Port ${port} requires elevated privileges`)
        process.exit(1)
        break
      case 'EADDRINUSE':
        HTTPSERVER(`Port ${port} is already in use`)
        process.exit(1)
        break
      default:
        throw error
    }
  })

  httpServer.on('listening', () => {
    HTTP_SERVER('Server listening on port ' + httpServer.address().port)
  })

  httpServer.listen(port)
}

export default httpServer