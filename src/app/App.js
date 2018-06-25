const EventEmitter = require('events')
const child = require('child_process')
const os = require('os')
const fs = require('fs')

const Boot = require('../system/Boot')
const Auth = require('../middleware/Auth')
const createTokenRouter = require('../routes/Token')
// const createUserRouter = require('../routes/users')
// const createDriveRouter = require('../routes/drives2')
// const createTimeDateRouter = require('../routes/TimeDate')
const createExpress = require('../system/express')
// const createTagRouter = require('../routes/tags')
// const createTaskRouter = require('../routes/tasks2')
// const createSambaRouter = require('../routes/samba')
// const createTransmissionRouter = require('../routes/transmission')

const express = require('express') // TODO
const { passwordEncrypt } = require('../lib/utils')

const routing = require('./routing')

const Pipe = require('./Pipe')

const Device = require('../fruitmix/Device')

const SlotConfPath = '/phi/slots'
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

    /**
     * {
     *    cloudToken,
     *    device: {
     *      deviceSN,
     *      deviceModel
     *    }
     * }
     */
    this.cloudConf = {
      auth: () => this.auth
    }

    if (opts.fruitmix) {
      this.fruitmix = opts.fruitmix
    } else if (opts.fruitmixOpts) {
      let configuration = opts.configuration
      let fruitmixOpts = opts.fruitmixOpts

      try {
        let slots
        if (fs.existsSync(SlotConfPath)) {
          slots = JSON.parse(fs.readFileSync(SlotConfPath).toString())
        }
        if (Array.isArray(slots)) {
          configuration.slots = slots
        }
      } catch(e) {}

      this.device = new Device(this)

      fruitmixOpts.chassisId = this.device.view().sn

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

    // create a Pipe
    this.pipe = new Pipe({
      fruitmix: () => this.fruitmix,
      config: this.cloudConf,
      boot: this.boot,
      device: this.device
    })

    // create server if required
    if (opts.useServer) {
      this.server = this.express.listen(3000, err => {
        if (err) {
          console.log('failed to listen on port 3000')
          process.exit(1) // TODO
        } else {
          console.log('server started on port 3000')
          process.send && process.send(JSON.stringify({
            type: 'appifi_started',
            data: {}
          }))
        }
      })
    }
    if (opts.listenProcess)
      process.on('message', this.handleMessage.bind(this))
  }

  handleMessage (msg) {
    let message
    try {
      message = JSON.parse(msg)
    } catch (e) {
      console.log('Bootstrap Message -> JSON parse Error')
      console.log(msg)
      return
    } 
    switch (message.type) {
      case 'pip':
        this.pipe.handleMessage(message)
        break
      case 'hello':
        break
      case 'bootstrap_token' :
        this.cloudConf.cloudToken = message.data.token
        break
      case 'bootstrap_device' :
        this.cloudConf.device = message.data
        break
      case 'bootstrap_boundUser':
        if (this.boot && message.hasOwnProperty('data')) this.boot.setBoundUser(message.data)
        break
      case 'bootstrap_unbind':
        if (this.boot) {
          return this.boot.volumeStore.save(null, (err, data) => {
            process.exit(61)
          })
        }
        break
      default:
        break
    }
  }

  createExpress () {
    this.auth = new Auth(this.secret, () => this.fruitmix ? this.fruitmix.user.users : [])

    let routers = []

    // boot router
    let bootr = express.Router()
    bootr.get('/', (req, res) => 
      res.status(200).json(this.boot.view()))

    bootr.patch('/', (req, res, next) => 
      this.boot.PATCH_BOOT(req.user, req.body, err => 
        err ? next(err) : res.status(200).end()))

    bootr.post('/boundVolume', (req, res, next) =>
      this.boot.init(req.body.target, req.body.mode, (err, data) =>
        err ? next(err) : res.status(200).json(data)))

    bootr.put('/boundVolume', (req, res, next) =>
      this.boot.import(req.body.volumeUUID, (err, data) =>
        err ? next(err) : res.status(200).json(data)))
        
    bootr.patch('/boundVolume', (req, res, next) => {
      let op = req.body.op
      let value = req.body.value
      switch (op) {
        case 'repair':
          this.boot.repair(value.devices, value.mode, (err, data) => err ? next(err) : res.status(200).json(data))
          break
        case 'add':
          this.boot.add(value.devices, value.mode, (err, data) => err ? next(err) : res.status(200).json(data))
          break
        case 'remove':
          this.boot.remove(value.devices, (err, data) => err ? next(err) : res.status(200).json(data))
          break
        default:
          next(Object.assign(new Error('op not found: ' + op), { status: 404 }))
          break
      }
    })

    bootr.delete('/boundVolume', (req, res,next) => 
      this.boot.uninstall(req.user, req.body, err => 
        err ? next(err) : res.status(200).end()))
      
    routers.push(['/boot', bootr])

    // token router
    let tokenr = createTokenRouter(this.auth)
    routers.push(['/token', tokenr])

    // boot router
    let devicer = express.Router()

    devicer.get('/', (req, res, next) => res.status(200).json(this.device.view()))
    devicer.get('/cpuInfo', (req, res) => res.status(200).json(this.device.cpuInfo()))
    devicer.get('/memInfo', (req, res, next) => this.device.memInfo((err, data) => err ? next(err) : res.status(200).json(data)))
    devicer.get('/speed', (req, res, next) => res.status(200).json(this.device.netDev()))
    // devicer.get('/usage', (req, res, next) => this.device.usageInfo((err, data) => err ? next(err) : res.status(200).json(data)))
    devicer.get('/timedate', (req, res, next) => this.device.timedate((err, data) => err ? next(err) : res.status(200).json(data)))
    devicer.get('/net', (req, res, next) => this.device.interfaces((err, its) => err ? next(err) : res.status(200).json(its)))
    devicer.post('/net', (req, res, next) => this.device.addAliases(req.body, (err, data) => err ? next(err) : res.status(200).json(data)))
    devicer.delete('/net/:name', (req, res, next) => this.device.deleteAliases(req.params.name, (err, data) => err ? next(err) : res.status(200).json(data)))
    devicer.get('/sleep', (req, res, next) => res.status(200).json(Object.assign({}, this.device.sleepConf)))
    devicer.patch('/sleep', (req, res, next) => this.device.updateSleepMode(req.user, req.body, (err, data) =>
        err ? next(err) : res.status(200).json(data)))
    routers.push(['/device', devicer])
    // all fruitmix router except token
    Object.keys(routing).forEach(key =>
      routers.push([routing[key].prefix, this.createRouter(this.auth, routing[key].routes)]))

    let opts = {
      auth: this.auth.middleware,
      settings: { json: { spaces: 2 } },
      log: this.opts.log || { skip: 'selected', error: 'selected' },
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
          res.status(200).sendFile(data, { dotfiles: 'allow'})
        } else {
          res.status(200).json(data)
        }
      }

      const anonymous = (req, res, next) =>
        req.headers['authorization'] ? next() : this.fruitmix.apis[resource][verb](null,
          Object.assign({}, req.query, req.body, req.params), f(res, next))

      const authenticated = (req, res, next) =>
        this.fruitmix.apis[resource][verb](req.user,
          Object.assign({}, req.query, req.body, req.params), f(res, next))

      const needReq = (req, res, next) =>
        this.fruitmix.apis[resource][verb](req.user,
          Object.assign({}, req.query, req.body, req.params, { req }), f(res, next))

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
              let props = Object.assign({}, req.params, req.query, { boundary, length, formdata: req })
              this.fruitmix.apis[resource][verb](req.user, props, f(res, next))
            }
          })
        } else {
          if (opts && opts.needReq) {
            router[method](rpath, stub, auth.jwt(), needReq)
          } else {
            router[method](rpath, stub, auth.jwt(), authenticated)
          }
        }
      }
    })

    // console.log(router.stack.map(l => l.route))

    return router
  }
}

module.exports = App
