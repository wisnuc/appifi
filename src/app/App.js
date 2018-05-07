const EventEmitter = require('events')

const Boot = require('../system/Boot')
const Auth = require('../middleware/Auth')
const createTokenRouter = require('../routes/Token')
const createUserRouter = require('../routes/users')
const createDriveRouter = require('../routes/drives2')
const createTimeDateRouter = require('../routes/TimeDate')
const createExpress = require('../system/express')
const createTagRouter = require('../routes/tags')
const createTaskRouter = require('../routes/tasks2')

const express = require('express') // TODO
const { passwordEncrypt } = require('../lib/utils')

const routing = require('./routing')

/**
Create An Application

An application is the top level container.

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

  If fruitmix is provided, the App works in fruitmix only mode.
  Otherwise, the App will create boot and the later is responsible for constructing the fruitmix instance. In this case, `fruitmixOpts` must be provided.

  @param {object} opts
  @param {string} opts.secret - secret for auth middleware to encode/decode token
  @param {Fruitmix} opts.fruitmix - injected fruitmix instance, the App works in fruitmix-only mode
  @param {object} opts.fruitmixOpts - if provided, it is passed to boot for constructing fruitmix
  @param {Configuration} opts.configuration - application wide configuration passed to boot
  @param {boolean} opts.useServer - if true, server will be created.
  */
  constructor (opts) {
    super()
    this.opts = opts

    // create express
    this.secret = opts.secret || 'Lord, we need a secret'

    if (opts.fruitmix) {
      this.fruitmix = opts.fruitmix
    } else if (opts.fruitmixOpts) {
      let configuration = opts.configuration
      let fruitmixOpts = opts.fruitmixOpts

      this.boot = new Boot({ configuration, fruitmixOpts })

      Object.defineProperty(this, 'fruitmix', { get () { return this.boot.fruitmix } })

      if (opts.useAlice) {
        this.boot.setBoundUser({
          phicommUserId: 'alice',
          password: passwordEncrypt('alice', 10)
        })
      }
    } else {
      throw new Error('either fruitmix or fruitmixOpts must be provided')
    }

    // create express instance
    this.createExpress()

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
    this.auth = new Auth(this.secret, () => this.fruitmix ? this.fruitmix.user.users : [])

    let routers = []
    let bootr = express.Router()
    bootr.get('/', (req, res) => res.status(200).json(this.boot.view()))
    bootr.post('/boundVolume', (req, res, next) =>
      this.boot.init(req.body.target, req.body.mode, (err, data) =>
        err ? next(err) : res.status(200).json(data)))

    routers.push(['/boot', bootr])

    let tokenr = createTokenRouter(this.auth)
    routers.push(['/token', tokenr])

/**
    if (this.fruitmix) {
      // if fruitmix is created, use fruitmix apis to decide which router should be created

      let apis = Object.keys(this.fruitmix.apis)

      if (apis.includes('user')) { routers.push(['/users', createUserRouter(this.auth, this.stub('user'))]) }

      if (apis.includes('drive')) {
        routers.push(['/drives', createDriveRouter(this.auth,
          this.stub('drive'), this.stub('dir'), this.stub('dirEntry'))])
      }

      if (apis.includes('file')) { routers.push(['/files', createFileRouter(this.auth, this.stub('file'))]) }

      if (apis.includes('tag')) { routers.push(['/tags', createTagRouter(this.auth, this.stub('tag'))]) }

      if (apis.includes('task')) { routers.push(['/tasks', createTaskRouter(this.auth, this.stub('task'), this.stub('taskNode'))]) }
    } else {
*/
      // let userr = express.Router()
      // userr.get('/', (req, res) => res.status(200).json({ hello: 'world' }))
      // routers.push(['/users', userr])

      // routers.push(['/users', createUserRouter(this.auth, this.stub('user'))])

      Object.keys(routing).forEach(key =>
        routers.push([routing[key].prefix, this.createRouter(this.auth, routing[key].routes)]))

      // console.log(routers)
//    }

    let opts = {
      auth: this.auth.middleware,
      settings: { json: { spaces: 2 } },
      log: this.opts.log || { skip: 'all', error: 'all' },
      routers
    }

    this.express = createExpress(opts)
  }

  /**
  Creates api stub for given resource name

  This design does NOT work well if there are too many sub resources. TODO

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
            let err = new Error(`method ${verb} not supported`)
            err.status = 405
            process.nextTick(() => callback(err))
          } else {
            this.fruitmix.apis[resource][verb](user, props, callback)
          }
        }
      }), {})
  }

  /**
  Create router from routes (defined in routing map)
  */
  createRouter (auth, routes) {
    let router = express.Router()
    let verbs = ['LIST', 'POST', 'POSTFORM', 'GET', 'PATCH', 'PUT', 'DELETE']

    routes.forEach(route => {
      const rpath = route[0]
      const verb = route[1]
      const resource = route[2]
      const opts = route[3]

      if (!verbs.includes(verb)) throw new Error('invalid verb')
      const method = verb === 'LIST' ? 'get' : verb === 'POSTFORM' ? 'post' : verb.toLowerCase()

      const stub = (req, res, next) => {
        if (!this.fruitmix) {
          let err = new Error('service unavailable')
          err.status = 503
          next(err)
        } else if (!this.fruitmix.apis[resource]) {
          let err = new Error(`resource ${resource} not found`)
          err.status = 404
          next(err)
        } else if (!this.fruitmix.apis[resource][verb]) {
          let err = new Error(`method ${verb} not supported`)
          err.status = 405
          next(err)
        } else {
          next()
        }
      }

      const f = (res, next) => (err, data) => {
        if (err) {
          next(err)
        } else if (!data) {
          res.status(200).end()
        } else if (typeof data === 'string') {
          res.status(200).sendFile(data)
        } else {
          res.status(200).json(data)
        }
      }

      const anonymous = (req, res, next) =>
        this.fruitmix.apis[resource][verb](null,
          Object.assign({}, req.query, req.body, req.params), f(res, next))

      const authenticated = (req, res, next) =>
        this.fruitmix.apis[resource][verb](req.user,
          Object.assign({}, req.query, req.body, req.params), f(res, next))

      if (opts && opts.auth === 'allowAnonymous') {
        router[method](rpath, stub, anonymous, auth.jwt(), authenticated)
      } else if (opts && typeof opts.auth === 'function') {
        router[method](rpath, stub, opts.auth(auth), authenticated)
      } else {
        if (verb === 'POSTFORM') {
          router[method](rpath, stub, auth.jwt(), (req, res, next) => {
            if (!req.is('multipart/form-data')) {
              let err = new Error('only multipart/form-data media type supported')
              err.status = 415
              next(err)
            } else {
              const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
              const m = regex.exec(req.headers['content-type'])
              let boundary = m[1] || m[2]
              let length = parseInt(req.headers['content-length'])
              let props = Object.assign({}, req.params, { boundary, length, formdata: req })
              this.fruitmix.apis[resource][verb](req.user, props, f(res, next))
            }
          })
        } else {
          router[method](rpath, stub, auth.jwt(), authenticated)
        }
      }
    })

    return router
  }
}

module.exports = App
