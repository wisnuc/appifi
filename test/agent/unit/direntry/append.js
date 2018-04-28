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

const { createTestFilesAsync } = require('src/utils/createTestFiles')

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

  let policies = [
    undefined,
    [null, null],
    [null, 'skip'],
    [null, 'replace'],
    [null, 'rename'],
    ['skip', null],
    ['skip', 'skip'],
    ['skip', 'replace'],
    ['skip', 'rename'],
    ['replace', null],
    ['replace', 'skip'],
    ['replace', 'replace'],
    ['replace', 'rename'],
    ['rename', null],
    ['rename', 'skip'],
    ['rename', 'replace'],
    ['rename', 'rename']
  ]

  describe('alice home', () => {
    let fruitmix, app, token, home

    before(async function () {
      this.timeout(0)

      try {
        await fs.lstatAsync('test-files')
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }

      // TODO
      // await mkdirpAsync('test-files')
      // process.stdout.write('      creating big files')
      // await createTestFilesAsync()
      // process.stdout.write('...done\n')
    })

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

    it(`200 append OneGiga to OneGiga`, function (done) {
      this.timeout(0)

      request(app.express)
        .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach(FILES.oneGiga.name, FILES.oneGiga.path, JSON.stringify({
          op: 'newfile',
          size: FILES.oneGiga.size,
          sha256: FILES.oneGiga.hash
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          // console.log(res.body)
          
          request(app.express)          
            .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .attach(FILES.oneGiga.name, FILES.oneGiga.path, JSON.stringify({
              op: 'append',
              hash: FILES.oneGiga.hash,
              size: FILES.oneGiga.size,
              sha256: FILES.oneGiga.hash
            }))
            // .expect(200)
            .end((err, res) => {
              // if (err) return done(err)
              console.log(err, res.body)
              done()
            })
        })
    })
  })
}) 
