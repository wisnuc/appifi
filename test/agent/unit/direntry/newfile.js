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

  describe('alice home, invalid name, size, sha256, policy', () => {
    let fruitmix, app, token, home, url
    let alonzo = FILES.alonzo

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
      url = `/drives/${home.uuid}/dirs/${home.uuid}/entries`
    })


    ;['hello/world', 'hello|world'].forEach(badname => {
      it(`400 if name ${badname}`, done => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach(badname, alonzo.path, JSON.stringify({
            op: 'newfile',
            size: alonzo.size,
            sha256: alonzo.hash
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.result[0].name).to.equal(badname)
            expect(res.body.result[0].error.status).to.equal(400)
            done()
          })
      })
    })

    ;[undefined, 'hello', {}, [], 99.99, -1, 1024 * 1024 * 1024 + 1].forEach(badsize => {
      it(`400 if size is ${badsize}`, done => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach('hello', alonzo.path, JSON.stringify({
            op: 'newfile',
            size: badsize,
            sha256: alonzo.hash
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            let r0 = res.body.result[0]
            expect(r0.name).to.equal('hello')
            expect(r0.fromName).to.equal('hello')
            expect(r0.toName).to.equal('hello')
            expect(r0.type).to.equal('file')
            expect(r0.op).to.equal('newfile')
            expect(r0.size).to.deep.equal(badsize)
            expect(r0.sha256).to.equal(alonzo.hash)
            expect(r0.error.status).to.equal(400)
            done()
          })
      })
    })

    ;[undefined, 1, {}, [], 'hello'].forEach(sha256 => {
      it(`400 if sha256 is ${sha256}`, done => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach('hello', alonzo.path, JSON.stringify({
            op: 'newfile',
            size: alonzo.size,
            sha256: sha256
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            let r0 = res.body.result[0]
            expect(r0.name).to.equal('hello')
            expect(r0.fromName).to.equal('hello')
            expect(r0.toName).to.equal('hello')
            expect(r0.type).to.equal('file')
            expect(r0.op).to.equal('newfile')
            expect(r0.size).to.equal(alonzo.size)
            expect(r0.sha256).to.deep.equal(sha256)
            expect(r0.error.status).to.equal(400)
            done()
          })
      })
    })

    ;[1, 'hello', {}, [], [null, null, null], ['hello', null], [null, 'hello']].forEach(policy => {
      it(`400 if policy is ${String(policy)}`, done => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach('hello', alonzo.path, JSON.stringify({
            op: 'newfile',
            size: alonzo.size,
            sha256: alonzo.hash,
            policy,
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            let r0 = res.body.result[0]
            expect(r0.name).to.equal('hello')
            expect(r0.fromName).to.equal('hello')
            expect(r0.toName).to.equal('hello')
            expect(r0.type).to.equal('file')
            expect(r0.op).to.equal('newfile')
            expect(r0.size).to.equal(alonzo.size)
            expect(r0.sha256).to.equal(alonzo.hash)
            expect(r0.policy).to.deep.equal(policy)
            expect(r0.error.status).to.equal(400)
            done()
          })
      })
    })
  }) 

  describe('alice home', () => {
    let fruitmix, app, token, home, url
    let alonzo = FILES.alonzo

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
      url = `/drives/${home.uuid}/dirs/${home.uuid}/entries`
    })

    it('400 if name is /hello', done => {
      request(app.express)
        .post(url)
        .set('Authorization', 'JWT ' + token)
        .attach('/hello', alonzo.path, JSON.stringify({
          op: 'newfile',
          size: alonzo.size,
          sha256: alonzo.hash
        }))
        .expect(400)
        .end((err, res) => {
          done()
        })
    })
    

    it.skip(`200 if no hello`, done => {
      request(app.express)
        .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          op: 'newfile',
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          console.log(res.body)
          done()
        })
    })

/**
    it(`200 if no hello`, done => {
      request(app.express)
        .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach(FILES.alonzo.name, FILES.alonzo.path, JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          console.log(res.body)
          done()
        })
    })
*/

/**
    it(`200 if no hello`, function (done) {
      this.timeout(0)
      request(app.express)
        .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach(FILES.oneGiga.name, FILES.oneGiga.path, JSON.stringify({
          size: FILES.oneGiga.size,
          sha256: FILES.oneGiga.hash
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          console.log(res.body)
          done()
        })
    })
**/

    /**
    target does not exists, all policies succeed. resolved is [false, false]
    */
/**
    policies.forEach(policy => {
      it(`200 if no hello, [${String(policy)}] resolved [false, false]`, done => {
        request(app.express)
          .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'mkdir' , policy }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body[0].resolved).to.deep.equal([false, false])
            done()
          })
      })
    })
*/
  })

})
