const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const { isUUID } = require('validator')

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const Auth = require('src/middleware/Auth')
const App = require('src/app/App')
const { USERS, DRIVES, requestToken, initUsersAsync, initFruitFilesAsync } = require('./tmplib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = tmptest
const { alice, bob, charlie } = USERS
const { alicePrivate, bobPrivate, buildIn, public1 } = DRIVES

describe(path.basename(__filename), () => {
  describe('ad hoc test', () => {
    beforeEach(async () => {
      await initFruitFilesAsync(fruitmixDir, { users: [alice, bob] })
    })

    it('alice GET /drives should return built-in and her private drives', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .get('/drives')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              let drives = res.body
              expect(drives).to.be.an('array')
              expect(drives.length).to.equal(2)

              let priv = drives.find(d => d.type === 'private')
              // expect(isUUID(priv.uuid, 4)).to.be.true
              expect(priv).to.deep.equal({
                uuid: priv.uuid,
                type: 'private',
                owner: alice.uuid,
                tag: 'home',
                label: '',
                isDeleted: false,
                smb: true
              })

              let builtIn = drives.find(d => d.type === 'public')
              expect(builtIn).to.deep.equal({
                uuid: builtIn.uuid,
                type: 'public',
                writelist: '*',
                readlist: '*',
                label: '',
                tag: 'built-in',
                smb: true
              })

              done()
            })
        })
      })
    })

    it('alice GET /drives/:driveUUID should return []', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .get('/drives')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              let drives = res.body
              let priv = drives.find(d => d.type === 'private')
              request(app.express)
                .get(`/drives/${priv.uuid}`)
                .set('Authorization', 'JWT ' + token)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)
                  expect(res.body).to.deep.equal(priv)
                  done()
                })
            })
        })
      })
    })

    it('alice POST /drives should create a public drive', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .post('/drives')
            .set('Authorization', 'JWT ' + token)
            .send({
              writelist: [bob.uuid],
              label: bob.username
            })
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              let priv = res.body
              expect(res.body).to.deep.equal({
                uuid: priv.uuid,
                type: 'public',
                writelist: [bob.uuid],
                readlist: [],
                label: 'bob',
                smb: true
              })
              done()
            })
        })
      })
    })

    it('bob POST /drives should return 403', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, bob.uuid, 'bob', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .post('/drives')
            .set('Authorization', 'JWT ' + token)
            .send({
              writelist: [alice.uuid],
              label: bob.username
            })
            .expect(403)
            .end(done)
        })
      })
    })

    it('alice PATCH /drives/:driveUUID update private drives`s label should success', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .get('/drives')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              let drives = res.body
              let priv = drives.find(d => d.type === 'private')
              request(app.express)
                .patch(`/drives/${priv.uuid}`)
                .set('Authorization', 'JWT ' + token)
                .send({
                  label: 'alice`s home'
                })
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)
                  priv.label = 'alice`s home'
                  expect(res.body).to.deep.equal(priv)
                  done()
                })
            })
        })
      })
    })
  })

  describe('alice create a public drive', () => {
    beforeEach(async () => {
      await initFruitFilesAsync(fruitmixDir, { users: [alice, bob, charlie], drives: [alicePrivate, bobPrivate, public1] })
    })

    it('alice PATCH /drives/:driveUUID should success', done => {
      let start = () => {
        if (++count !== 2) return
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .patch(`/drives/${public1.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .send({
              writelist: [alice.uuid, bob.uuid, charlie.uuid],
              label: bob.username
            })
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              let pub = Object.assign({}, public1)
              pub.writelist = [alice.uuid, bob.uuid, charlie.uuid].sort()
              pub.label = bob.username
              expect(res.body).to.deep.equal(pub)
              done()
            })
        })
      }
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      let count = 0
      fruitmix.drive.once('Update', start)
      fruitmix.user.once('Update', start)
    })

    it('bob PATCH /drives/:driveUUID should return 403', done => {
      let start = () => {
        if (++count !== 2) return
        requestToken(app.express, bob.uuid, 'bob', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .patch(`/drives/${public1.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .send({
              writelist: [alice.uuid, bob.uuid, charlie.uuid],
              label: bob.username
            })
            .expect(403)
            .end(done)
        })
      }
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      let count = 0
      fruitmix.drive.once('Update', start)
      fruitmix.user.once('Update', start)
    })

    it('alice DELETE bob drive should be deleted', function(done) {
      this.timeout(0)
      let start = () => {
        if (++count !== 2) return
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .delete(`/users/${bob.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if(err) return done(err)
              setTimeout(() => {
                let pud = Object.assign({}, public1)
                pud.writelist = []
                let bP = Object.assign({}, bobPrivate, { isDeleted: true })
                let bb = Object.assign({}, bob, { status: 'DELETED' })
                expect(fruitmix.drive.drives).to.deep.equal([alicePrivate, bP, pud])
                expect(fruitmix.user.users).to.deep.equal([alice, bb, charlie])
                done()
              }, 500)
            })
        })
      }
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      let count = 0
      fruitmix.drive.once('Update', start)
      fruitmix.user.once('Update', start)
    })
  })
})
