const http = require('http')
const app = require('express')()
const logger = require('morgan')
const bodyParser = require('body-parser')

module.exports = system => {

  const port = 3000

  app.use(logger('dev', { skip: (req, res) => res.nolog === true }))

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  app.set('json spaces', 2)

  // mute polling
  app.get('/server', (req, res) => (res.nolog = true) && res.status(404).end())

  app.use('/system', system)

  // catch 404 and forward to error handler
  app.use((req, res, next) => next(Object.assign(new Error('Not Found'), { status: 404 })))
  // final catch ??? TODO
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
    console.log('[system] server listening on port ' + httpServer.address().port)
  })

  httpServer.listen(port);
}
