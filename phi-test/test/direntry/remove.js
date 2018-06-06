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

const {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync
} = require('../lib')


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

  describe('alice home', () => {
    let fruitmix, app, token, home

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      fruitmix = new Fruitmix({ fruitmixDir })
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
    })

    it('200 remove /hello-dir/world-dir @ /hello-dir/world-dir', done => {
      request(app.express)
        .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello-dir', JSON.stringify({ op: 'mkdir' }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)
          let helloDir = res.body[0].data

          request(app.express)
            .post(`/drives/${home.uuid}/dirs/${helloDir.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('world-dir', JSON.stringify({ op: 'mkdir' }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
 
              let worldPath = path.join(tmptest, 'fruitmix', 'drives', home.uuid, 'hello-dir', 'world-dir') 
              fs.lstatSync(worldPath)

              request(app.express)
                .post(`/drives/${home.uuid}/dirs/${helloDir.uuid}/entries`)
                .set('Authorization', 'JWT ' + token)
                .field('world-dir', JSON.stringify({ op: 'remove' })) 
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)
                  expect(res.body[0].op).to.equal('remove')
                  expect(res.body[0].data).to.equal(null)
                  expect(() => fs.lstatSync(worldPath)).to.throw().that.has.property('code').to.equal('ENOENT')
                  done()
                }) 

            })

        })
    }) 

    it('200 remove /hello-dir/world-file @ /hello-dir/world-file', done => {
      request(app.express)
        .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello-dir', JSON.stringify({ op: 'mkdir' }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)
          let helloDir = res.body[0].data

          request(app.express)
            .post(`/drives/${home.uuid}/dirs/${helloDir.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .attach('world-file', FILES.alonzo.path, JSON.stringify({ 
              op: 'newfile',
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash 
            }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
 
              let worldPath = path.join(tmptest, 'fruitmix', 'drives', home.uuid, 'hello-dir', 'world-file') 
              fs.lstatSync(worldPath)

              request(app.express)
                .post(`/drives/${home.uuid}/dirs/${helloDir.uuid}/entries`)
                .set('Authorization', 'JWT ' + token)
                .field('world-file', JSON.stringify({ op: 'remove' })) 
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)
                  expect(res.body[0].op).to.equal('remove')
                  expect(res.body[0].data).to.equal(null)
                  expect(() => fs.lstatSync(worldPath)).to.throw().that.has.property('code').to.equal('ENOENT')
                  done()
                }) 

            })

        })
    }) 

    it('200 remove /hello-dir/world @ /hello-dir', done => {
      request(app.express)
        .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello-dir', JSON.stringify({ op: 'mkdir' }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)
          let helloDir = res.body[0].data

          request(app.express)
            .post(`/drives/${home.uuid}/dirs/${helloDir.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('world', JSON.stringify({ op: 'remove' }))
            .expect(200)
            .end(done)
        })     
    })
  })
})




