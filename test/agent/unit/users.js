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

    it('should retrieve toke (no assert)', done => {
      let app = createApp()
      fruitmix.once('FruitmixStarted', () =>
        request(app)
          .get('/token')
          .auth(alice.uuid, 'alice')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            // console.log(res.body)
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

    it('anonymous user GET /users should return [alice, bob] basic info', done => {
      let app = createApp()
      fruitmix.once('FruitmixStarted', () => {
        request(app)
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

    it('alice GET /users should return [alice, bob] full info', done => {
      let app = createApp()
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app)
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

    it('bob GET /users should return [alice, bob] basic info', done => {
      let app = createApp()
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app, bob.uuid, 'bob', (err, token) => {
          if (err) return done(err)
          request(app)
            .get('/users')
            .set('Authorization', 'JWT ' + token)
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
    })

    it('POST /users should fail', done => {
      done(new Error('TBD'))
    })

    it('anonymous GET /users/:alice.uuid should 401', done => {
      let app = createApp()
      fruitmix.once('FruitmixStarted', () => {
        request(app)
          .get(`/users/${alice.uuid}`)
          .expect(401)
          .end(done)
      })
    })

    it('alice GET /users/:alice.uuid should get her full info', done => {
      let app = createApp()
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app)
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
