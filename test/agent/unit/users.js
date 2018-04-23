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
const Auth = require('src/middleware/Auth')
const createTokenRouter = require('src/routes/Token')
const createUserRouter = require('src/routes/users')
const createExpress = require('src/system/express')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

// node src/utils/md4Encrypt.js alice

const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  phicommUserId: 'alice'
}

const bob = {
  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
  username: 'bob',
  isFirstUser: false,
  password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
  smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'bob'
}

const charlie = {
  uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
  username: 'charlie',
  password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
  smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'charlie'
}

describe(path.basename(__filename), () => {
  let fruitmix
  let app

  const createApp = () => {
    fruitmix = new Fruitmix({ fruitmixDir })
    let auth = new Auth('some secret', () => fruitmix.users)
    let token = createTokenRouter(auth)
    let users = createUserRouter(auth, () => fruitmix)

    let opts = {
      auth: auth.middleware,
      settings: { json: { spaces: 2 } },
      log: { skip: 'all', error: 'all' },
      routers: [
        ['/token', token],
        ['/users', users]
      ]
    }

    return createExpress(opts)
  }

  const createApp2 = () => {
    let fruitmix = new Fruitmix({ fruitmixDir }) 
    app = new App({ fruitmix })
  }

  const requestToken = (app, userUUID, password, callback) => {
    request(app)
      .get('/token')
      .auth(userUUID, password)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null, res.body.token)
      })
  }

  describe('test token', () => {
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      let usersFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(usersFile, JSON.stringify([alice, bob], null, '  '))
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
              token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiY2IzM2I1YjMtZGQ1OC00NzBmLThjY2MtOTJhYTA0ZDc1NTkwIn0.0lp4tfIyz4kn1QDJqmZ4pYp0Y5oh-W9ta26yS34qVok' })
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
              { uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
                username: 'alice',
                isFirstUser: true,
                phicommUserId: 'alice' },
              { uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
                username: 'bob',
                isFirstUser: false,
                phicommUserId: 'bob' }
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
                [ { uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
                  username: 'alice',
                  isFirstUser: true,
                  phicommUserId: 'alice',
                  password: true,
                  smbPassword: true },
                { uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
                  username: 'bob',
                  isFirstUser: false,
                  phicommUserId: 'bob',
                  password: true,
                  smbPassword: true } ])
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
                  smbPassword: true 
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
              phicommUserId: 'Jack'
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
              phicommUserId: 'Jack'
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
            if(err) return done(err)
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
                smbPassword: true 
              })
              done()
            })
        })
      })
    })

  })
})
