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

  const requestToken = (express, userUUID, password, callback) =>
    request(express)
      .get('/token')
      .auth(userUUID, password)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body.token))

  const requestTokenAsync = Promise.promisify(requestToken)

  const requestHome = (express, userUUID, token, callback) =>
    request(express)
      .get('/drives')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        let home = res.body.find(d => d.type === 'private' && d.owner === userUUID)
        if (!home) {
          callback(new Error('home drive not found'))
        } else {
          callback(null, home)
        }
      })

  const requestHomeAsync = Promise.promisify(requestHome)

  describe('ad hoc test', () => {
    
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice, bob], null, '  '))
    })

    it.skip('alice GET /drives should return built-in and her private drives, (broken)', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          request(app.express)
            .get('/drives')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              let drives = res.body
              console.log(drives)
              expect(drives).to.be.an('array')
              expect(drives.length).to.equal(2)

              let priv = drives.find(d => d.type === 'private')
              expect(isUUID(priv.uuid, 4)).to.be.true
              expect(priv).to.deep.equal({
                uuid: priv.uuid,
                type: 'private',
                owner: alice.uuid,
                tag: 'home' 
              })

              let builtIn = drives.find(d => d.type === 'public')
              expect(isUUID(builtIn.uuid, 4)).to.be.true
              expect(builtIn).to.deep.equal({
                uuid: builtIn.uuid,
                type: 'public',
                writelist: '*',
                readlist: '*',
                label: '',
                tag: 'built-in'
              })

              done()
            })
        })
      })
    })
  })

  describe('dir entry api', () => {
    
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice, bob], null, '  '))
    })

    it('alice GET home should return root path and empty entries, 67fe6ab9', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          requestHome(app.express, alice.uuid, token, (err, home) => {
            if (err) return done(err)
            request(app.express)
              .get(`/drives/${home.uuid}/dirs/${home.uuid}`)
              .set('Authorization', 'JWT ' + token)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)    
                expect(res.body).to.deep.equal({
                  path: [{
                    uuid: home.uuid,
                    name: home.uuid,
                    mtime: res.body.path[0].mtime,
                  }],
                  entries: []
                })
                done()
              })
          })
        })
      })
    })

    it('200 if hello not exist, 7ab3c59f', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          requestHome(app.express, alice.uuid, token, (err, home) => {
            if (err) return done(err)
            request(app.express)
              .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
              .set('Authorization', 'JWT ' + token)
              .field('hello', JSON.stringify({ op: 'mkdir' }))
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                console.log(res.body)
                done()
              })
          })
        })
      })
    })

    it('200 if hello not exist, 7ab3c59f', function (done) {
      this.timeout(10000)

      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          requestHome(app.express, alice.uuid, token, (err, home) => {
            if (err) return done(err)
            let req = request(app.express)
              .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
              .set('Authorization', 'JWT ' + token)
              .field('hello', JSON.stringify({ op: 'mkdir' }))

            for (let i = 0; i < 4; i++)
              req.field('hello', JSON.stringify({ op: 'mkdir', policy: ['skip', null] }))

             req.expect(200)
              .end((err, res) => {
                if (err) return done(err)
                console.log(JSON.stringify(res.body, null, '  '))
                done()
              })
          })
        })
      })
    })
  
  })

})

process.on('uncaughtException', err => console.log(err))
