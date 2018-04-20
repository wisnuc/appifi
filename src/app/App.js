const Boot = require('./system/Boot')

const Auth = require('./middleware/Auth')
const createTokenRouter = require('./routes/Token')
const createUserRouter = require('./routes/users')
const createTimeDateRouter = require('./routes/TimeDate')
const createExpress = require('./system/express')

/**
Create An Application

An application is something like:

```js
App {
  fruitmix: "fruitmix model and service methods",
  station: "bridging fruitmix and cloud",
  boot: "for system-level functions",
  express: "an express application",
  server: "an http server",
}
```

The combination is configurable.

1. fruitmix can be constructed independently.
2. station need fruitmix to be fully functional, but without fruitmix, it may do some basic things, such as reporting error to cloud.
3. boot is optional. With boot, it is boot's responsibility to construct fruitmix. Without boot, the App create fruitmix on it's own.
4. express requires fruitmix but not vice-versa.
5. express uses static routing. API stubs are created when constructing App. It is App's responsibility to construct those stubs.
6. server is optional.

@module App
*/

/**
App is the top-level container for the application.
*/
class App extends EventEmitter {

  /**
  Creates an App instance

  @param {object} opts
  @param {string} opts.secret - secret for auth middleware to encode/decode token
  @param {boolean} opts.useBoot - if true, create boot and boot is responsible for creating fruitmix.
  @param {object} fruitmixOpts - if useBoot is false, this opts is used to create fruitmix immediately
  @param {boolean} opts.useServer - if true, server will be created.
  */
  constructor (opts) {
    super()

    // create boot or fruitmix
    if (opts.useBoot) {
      this.boot = new Boot(' happened, lord') // TODO
      this.fruitmix = null 
    } else {
      this.fruitmix = new Fruitmix(opts.fruitmixOpts)
    }

    // create express
    this.secret = opts.secret || 'Lord, I need something secret'
    this.express = this.createExpress()

    // create server if required
    if (opts.useServer) {
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

  handleMessage (message) {
    switch (message.type) {
      case 'hello': 
        break
      default:
        break
    }
  }

  createExpress () {
    this.auth = new Auth(this.secret)
    let routers = []
    if (this.fruitmix) {
      // if fruitmix is created, use fruitmix apis to decide which router should be created
      let apis = Object.keys(this.fruitmix.apis)
      if (apis.includes('user')) 
        routers.push(['/users', createUserRouter(auth, this.stub('user'))])
      if (apis.includes('drive')) 
        routers.push(['/drives', createDriveRouter(auth, this.stub('drive'))])

    } else {
      // TODO create all routers
      // if fruitmix is not created, blindly create all? or even if 
      // fruitmix is not created immediately, the fruitmixOpts should be passed to 
      // boot and we can still use it to select which router to be started?
    } 

    let opts = {
      auth: this.auth.middleware,
      settings: { json: { spaces: 2 } },
      log: { skip: 'all', error: 'all' },
      routers
    }

    this.express = createExpress(opts)
  }

  createServer (secret) {
    this.auth = new Auth(secret)
    this.token = TokenRouter(this.auth)
    this.timedate = TimeDateRouter(this.auth)

    let opts = {
      auth: this.auth.middleware,
      settings: { json: { spaces: 2 } },
      log: { skip: 'all', error: 'all' },
      routers: [
        ['/token', this.token],
      ]
    }

    this.express = createExpress(opts)
  }

  /**
  Creates api stub for given resource name 

  @param {string} resource - resource name (singular, such as user, drive, etc)
  @returns an object with api methods. 
  */ 
  stub (resource) {
    let verbs = ['LIST', 'POST', 'POSTFORM', 'GET', 'PATCH', 'PUT', 'DELETE']
    return verbs.reduce((stub, verb) => 
      Object.assign(stub, { 
        [verb]: (user, props, callback) => {
          if (!this.fruitmix) {
            let err = new Error('service unavailable')
            err.status = 503
            process.nextTick(() => callback(err))
          } else if (!this.fruitmix.apis[resource]) {
            let err = new Error('resource not found')
            err.status = 404
            process.nextTick(() => callback(err))
          } else if (!this.fruitmix.apis[resource][verb]) {
            let err = new Error('method not supported')
            err.status = 405
            process.nextTick(() => callback(err))
          } else {
            this.fruitmix.apis[resource][verb](user, props, callback)
          }
        } 
      }), {})
  }

}

module.exports = App
