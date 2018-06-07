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

const {
  requestToken,
  requestTokenAsync,
  requestHome,
  requestHomeAsync,
  list,
  listAsync,
  mkdir,
  mkdirAsync
} = require('./lib')

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
  phicommUserId: 'alice',
  status: 'ACTIVE'
}

const bob = {
  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
  username: 'bob',
  password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
  smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'bob',
  status: 'ACTIVE'
}

const charlie = {
  uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
  username: 'charlie',
  password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
  smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'charlie',
  status: 'ACTIVE'
}

describe(path.basename(__filename), () => {

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
      home = await requestHomeAsync(app.express, { user: alice, token })
    })

    it('get home with hello dir', done => {
      request(app.express)
        .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)   
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {

          request(app.express)
            .get(`/drives/${home.uuid}/dirs/${home.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              console.log(res.body)
              done()
            })

        })
    })

    it('get home with hello dir', async () => {
      let hello = await mkdirAsync(app.express, { 
        token, driveUUID: home.uuid, dirUUID: home.uuid, name: 'hello' })
      await mkdirAsync(app.express, { token, driveUUID: home.uuid, dirUUID: hello.uuid, name: 'world' })
      await mkdirAsync(app.express, { token, driveUUID: home.uuid, dirUUID: home.uuid, name: 'foo' })
      await mkdirAsync(app.express, { token, driveUUID: home.uuid, dirUUID: home.uuid, name: 'bar' })

      console.log(await listAsync(app.express, { token, driveUUID: home.uuid, dirUUID: home.uuid }))
      console.log(await listAsync(app.express, { token, driveUUID: home.uuid, dirUUID: hello.uuid }))
    })
  })
})

