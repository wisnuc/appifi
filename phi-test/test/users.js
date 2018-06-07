const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')
const { USERS, requestToken, initUsersAsync } = require('./tmplib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = tmptest

const { alice, bob, charlie } = USERS

describe(path.basename(__filename), () => {
  describe('test token', () => {
    beforeEach(async () => {
      await initUsersAsync(fruitmixDir, [alice, bob])
    })

    it('should retrieve token (no assert), 95971542', done => {
      let secret = 'secret'
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ secret, fruitmix })
      fruitmix.once('FruitmixStarted', () =>
        request(app.express)
          .get('/token')
          .auth(alice.uuid, 'alice')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body).to.deep.equal({
              type: 'JWT',
              token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiY2IzM2I1YjMtZGQ1OC00NzBmLThjY2MtOTJhYTA0ZDc1NTkwIn0.0lp4tfIyz4kn1QDJqmZ4pYp0Y5oh-W9ta26yS34qVok',
              forRemote: false
            })
            done()
          }))
    })
  })

  describe('test users api', () => {
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      let usersFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(usersFile, JSON.stringify([alice, bob], null, '  '))
    })

    it('boundUser phoneNumber update', done => {
      let newPhoneNumber = '12345566789'
      let fruitmix = new Fruitmix({ fruitmixDir, boundUser:{
        phicommUserId: alice.phicommUserId,
        phoneNumber: newPhoneNumber
      } })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        setTimeout(() => {
          let al = fruitmix.users.find(u => u.uuid === alice.uuid)
          expect(al.phoneNumber).to.equal(newPhoneNumber)
          done()
        }, 200)
      })
    })

    it('anonymous user GET /users should return [alice, bob] basic info, aa6f1f06', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        request(app.express)
          .get('/users')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body).to.deep.equal([
              {
                uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
                username: 'alice',
                isFirstUser: true,
                phicommUserId: 'alice',
                phoneNumber: alice.phoneNumber
              },
              {
                uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
                username: 'bob',
                isFirstUser: false,
                phicommUserId: 'bob',
                phoneNumber: bob.phoneNumber
              }
            ])
            done()
          })
      })
    })

    it('alice GET /users should return [alice, bob] full info, 7ce85fa9', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .get('/users')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body).to.deep.equal(
                [{
                  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
                  username: 'alice',
                  isFirstUser: true,
                  phicommUserId: 'alice',
                  password: true,
                  smbPassword: true,
                  status: alice.status,
                  createTime: alice.createTime,
                  phoneNumber: alice.phoneNumber
                },
                {
                  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
                  username: 'bob',
                  isFirstUser: false,
                  phicommUserId: 'bob',
                  password: true,
                  smbPassword: true,
                  status: bob.status,
                  createTime: bob.createTime,
                  phoneNumber: bob.phoneNumber
                }])
              done(err)
            })
        })
      })
    })

    it('bob GET /users should return [bob] full info, 911b416e', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, bob.uuid, 'bob', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .get('/users')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body).to.deep.equal([
                {
                  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
                  username: 'bob',
                  isFirstUser: false,
                  phicommUserId: 'bob',
                  password: true,
                  smbPassword: true,
                  status: bob.status,
                  createTime: bob.createTime,
                  phoneNumber: bob.phoneNumber
                }
              ])
              done()
            })
        })
      })
    })

    it('alice POST /users should create charlie, fd7e7872', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .post('/users')
            .set('Authorization', 'JWT ' + token)
            .send({
              username: 'Jack',
              phicommUserId: 'Jack',
              phoneNumber: '12334444555'
            })
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.username).to.equal('Jack')
              expect(res.body.phicommUserId).to.equal('Jack')
              expect(fruitmix.users.length).to.equal(3)
              expect(fruitmix.users[2].username).to.equal('Jack')

              console.log(res.body)

              done()
            })
        })
      })
    })

    it('bob POST /users should fail, 5ebc3100', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, bob.uuid, 'bob', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .post('/users')
            .set('Authorization', 'JWT ' + token)
            .send({
              username: 'Jack',
              phicommUserId: 'Jack',
              phoneNumber: '12255558888'
            })
            .expect(403)
            .end(done)
        })
      })
    })

    it('bob update himself username should success', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, bob.uuid, 'bob', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .patch(`/users/${bob.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .send({
              username: 'Jack'
            })
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.username).to.equal('Jack')
              expect(fruitmix.users.find(x => x.uuid === bob.uuid).username).to.equal('Jack')
              done()
            })
        })
      })
    })

    it('bob update alice`s username should fail', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, bob.uuid, 'bob', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .patch(`/users/${alice.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .send({
              username: 'Jack'
            })
            .expect(403)
            .end(done)
        })
      })
    })



    it('bob update himself password should success', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        request(app.express)
          .patch(`/users/${bob.uuid}`)
          .auth(bob.uuid, 'bob')
          .send({
            password: alice.password,
            encrypted: true
          })
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.username).to.equal('bob')
            expect(fruitmix.users.find(x => x.uuid === bob.uuid).password).to.equal(alice.password)
            done()
          })
      })
    })

    it('bob update alice`s password should fail', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        request(app.express)
          .patch(`/users/${alice.uuid}`)
          .auth(bob.uuid, 'bob')
          .send({
            password: bob.password,
            encrypted: true
          })
          .expect(403)
          .end(done)
      })
    })

    it('alice update bob`s username should success', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .patch(`/users/${bob.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .send({
              username: 'Jack'
            })
            .expect(200)
            .end((err, res) => {
              expect(res.body.username).to.equal('Jack')
              expect(fruitmix.users.find(x => x.uuid === bob.uuid).username).to.equal('Jack')
              done()
            })
        })
      })
    })

    it('anonymous GET /users/:alice.uuid should 401', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        request(app.express)
          .get(`/users/${alice.uuid}`)
          .expect(401)
          .end(done)
      })
    })

    it('alice GET /users/:alice.uuid should get her full info', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .get(`/users/${alice.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body).to.deep.equal({
                uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
                username: 'alice',
                isFirstUser: true,
                phicommUserId: 'alice',
                password: true,
                smbPassword: true,
                createTime: alice.createTime,
                phoneNumber: alice.phoneNumber,
                status: alice.status
              })
              done()
            })
        })
      })
    })
  })
})
