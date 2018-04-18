const Boot = require('./system/Boot')

const Express = require('./system/express')
const Auth = require('./middleware/Auth')
const Token = require('./routes/Token')
const TimeDate = require('./routes/TimeDate')

/**
@module App
*/

/**
App is the top-level component containing all model and service objects.
*/
class App {

  /**
  Creates a App instance
  */
  constructor () {
    this.boot = new Boot('something')
  }

  handleMessage (message) {
    switch (message.type) {
      case 'SECRET':
        this.createServer(message.data)
        break
      default:
        break
    }
  }

  createServer (secret) {
    this.auth = new Auth(secret)
    this.token = Token(this.auth)
    this.timedate = TimeDate(this.auth)

    let opts = {
      auth: this.auth.middleware,
      settings: { json: { spaces: 2 } },
      log: { skip: 'all', error: 'all' },
      routers: [
        ['/token', this.token],
        ['/control/timedate', this.timedate]
      ]
    }

    this.express = Express(opts)
    this.server = this.express.listen(3000, err => {
      if (err) {
        console.log('failed to listen on port 3000')
        process.exit(1) // TODO
      } else {
        console.log('server started on port 3000')
      }
    })
  }

}

module.exports = App
