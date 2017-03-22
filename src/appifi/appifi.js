const http = require('http')
const app = require('./index')
const port = 3000

// inject (piggyback) system api
module.exports = system => {

  app.use('/system', system)

  // catch 404 and forward to error handler
  app.use((req, res, next) => next(Object.assign(new Error('Not Found'), { status: 404 })))

  // development error handler will print stacktrace
  if (app.get('env') === 'development') {
    app.use((err, req, res) => res.status(err.status || 500).send('error: ' + err.message))
  }

  // production error handler no stacktraces leaked to user
  app.use((err, req, res) => res.status(err.status || 500).send('error: ' + err.message))

  app.set('port', port);

  const httpServer = http.createServer(app);

  httpServer.on('error', error => {

    if (error.syscall !== 'listen') throw error;
    switch (error.code) {
      case 'EACCES':
        console.error(`Port ${port} requires elevated privileges`)
        process.exit(1)
        break
      case 'EADDRINUSE':
        console.error(`Port ${port} is already in use`)
        process.exit(1)
        break
      default:
        throw error
    }
  })

  httpServer.on('listening', () => {
    console.log('[app.js] Listening on port ' + httpServer.address().port)
  })

  httpServer.listen(port);
}

