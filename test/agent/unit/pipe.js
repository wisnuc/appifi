const path = require('path')
const debug = require('debug')('pipe:test')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')
// const Pipe = require('src/app/pipe')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const { USERS, initUsersAsync, initFruitFilesAsync } = require('./tmplib')
const { alice, bob, charlie } = USERS

/**
 * TODO: mock cloud server in oder to test request result from NAS to cloud.
 */
describe(path.basename(__filename), () => {
  beforeEach(async () => {
    await initUsersAsync(fruitmixDir, [alice])
    await initFruitFilesAsync(fruitmixDir, { users: [alice, bob] })
  })

  it('have no cloudConf should return error', done => {
    let fruitmix = new Fruitmix({ fruitmixDir })
    let app = new App({ fruitmix })
    let pipe = app.pipe
    try {
      pipe.handleMessage()
      done()
    } catch (err) {
      expect(err.message).to.be.equal('pipe have no cloudConf')
      done(err)
    }
  })

  it('token should return token', done => {
    let fruitmix = new Fruitmix({ fruitmixDir })
    let app = new App({ fruitmix })
    let pipe = app.pipe
    app.cloudConf.cloudToken = 'xxxxx'
    app.cloudConf.device = { deviceSN: '123123' }
    try {
      const message = {
        type: 'pip',
        msgId: 'xxxx',
        packageParams: {
          sendingServer: '127.0.0.1',
          waitingServer: '127.0.0.1',
          uid: alice['phicommUserId']
        },
        data: {
          verb: 'GET',
          urlPath: '/token',
          body: {},
          params: {}
        }
      }
      pipe.handleMessage(message)
      done()
    } catch (err) {
      done(err)
    }
  })

  it('cammand should return json', done => {
    let fruitmix = new Fruitmix({ fruitmixDir })
    let app = new App({ fruitmix })
    let pipe = app.pipe
    app.cloudConf.cloudToken = 'xxxxx'
    app.cloudConf.device = { deviceSN: '123123' }
    try {
      const message = {
        type: 'pip',
        msgId: 'xxxx',
        packageParams: {
          sendingServer: '127.0.0.1',
          waitingServer: '127.0.0.1',
          uid: alice['phicommUserId']
        },
        data: {
          verb: 'GET',
          urlPath: '/drives/123',
          body: {},
          params: {}
        }
      }
      pipe.handleMessage(message)
      done()
    } catch (err) {
      debug(err)
      done(err)
    }
  })

  // it('fetch resource should return stream', done => {
  //   const start = () => {
  //     if (++count !== 2) return
  //     let pipe = app.pipe
  //     app.cloudConf.cloudToken = 'xxxxx'
  //     app.cloudConf.device = { deviceSN: '123123' }
  //     try {
  //       const message = {
  //         type: 'pip',
  //         msgId: 'xxxx',
  //         packageParams: {
  //           sendingServer: '127.0.0.1',
  //           waitingServer: '127.0.0.1',
  //           uid: alice['phicommUserId']
  //         },
  //         data: {
  //           verb: 'GET',
  //           urlPath: '/drives/123',
  //           body: {},
  //           params: {}
  //         }
  //       }
  //       pipe.handleMessage(message)
  //       done()
  //     } catch (err) {
  //       done(err)
  //     }
  //   }
  //   let fruitmix = new Fruitmix({ fruitmixDir })
  //   let app = new App({ fruitmix })
  //   let count = 0
  //   fruitmix.drive.once('Update', start)
  //   fruitmix.user.once('Update', start)
  // })

  // it('store resource should return stream', done => {
  //   const start = () => {
  //     if (++count !== 2) return
  //     let pipe = app.pipe
  //     app.cloudConf.cloudToken = 'xxxxx'
  //     app.cloudConf.device = { deviceSN: '123123' }
  //     try {
  //       const message = {
  //         type: 'pip',
  //         msgId: 'xxxx',
  //         packageParams: {
  //           sendingServer: '127.0.0.1',
  //           waitingServer: '127.0.0.1',
  //           uid: alice['phicommUserId']
  //         },
  //         data: {
  //           verb: 'GET',
  //           urlPath: '/drives/123',
  //           body: {},
  //           params: {}
  //         }
  //       }
  //       pipe.handleMessage(message)
  //       done()
  //     } catch (err) {
  //       done(err)
  //     }
  //   }
  //   let fruitmix = new Fruitmix({ fruitmixDir })
  //   let app = new App({ fruitmix })
  //   let count = 0
  //   fruitmix.drive.once('Update', start)
  //   fruitmix.user.once('Update', start)
  // })
})
