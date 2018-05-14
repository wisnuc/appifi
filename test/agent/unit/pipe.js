const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const debug = require('debug')('pipe:test')
const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const Auth = require('src/middleware/Auth')
const App = require('src/app/App')
// const Pipe = require('src/app/pipe')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const { USERS, DRIVES, requestToken, initUsersAsync, initFruitFilesAsync } = require('./tmplib')
const { alice, bob, charlie } = USERS

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
    } catch (err) {
      expect(err.message).to.be.equal('Pipe have no cloudConf')
      done()
    }
  })

  it('token should return token', done => {
    const start = async () => {
      if (++count !== 2) return
      let pipe = app.pipe
      app.cloudConf.cloudToken = 'xxxxx'
      app.cloudConf.device = { deviceSN: '123123' }
      try {
        const message = {
          type: 'pip',
          msgId: 'xxxx',
          packageParams: {
            sendingServer: '127.0.0.1',
            watingServer: '127.0.0.1',
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
    }
    let fruitmix = new Fruitmix({ fruitmixDir })
    let app = new App({ fruitmix })
    let count = 0
    fruitmix.drive.once('Update', start)
    fruitmix.user.once('Update', start)
  })

  it('cammand should return json', done => {
    const start = async () => {
      if (++count !== 2) return
      let pipe = app.pipe
      app.cloudConf.cloudToken = 'xxxxx'
      app.cloudConf.device = { deviceSN: '123123' }
      try {
        const message = {
          type: 'pip',
          msgId: 'xxxx',
          packageParams: {
            sendingServer: '127.0.0.1',
            watingServer: '127.0.0.1',
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
        done(err)
      }
    }
    let fruitmix = new Fruitmix({ fruitmixDir })
    let app = new App({ fruitmix })
    let count = 0
    fruitmix.drive.once('Update', start)
    fruitmix.user.once('Update', start)
  })

  // it('fetch resource should return stream', done => {
  //   const start = async () => {
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
  //           watingServer: '127.0.0.1',
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
  //   const start = async () => {
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
  //           watingServer: '127.0.0.1',
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
