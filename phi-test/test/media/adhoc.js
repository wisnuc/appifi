const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const crypto = require('crypto')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const UUID = require('uuid')
const ioctl = require('ioctl')
const xattr = require('fs-xattr')
const { isUUID } = require('validator')
const sizeOf = require('image-size')

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const FILES = require('../lib').FILES

const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  status: 'ACTIVE',
  phicommUserId: 'alice'
}

const bob = {
  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
  username: 'bob',
  password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
  smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  status: 'ACTIVE',
  phicommUserId: 'bob'
}

const charlie = {
  uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
  username: 'charlie',
  password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
  smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  status: 'ACTIVE',
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

    let fruitmix, app, token, home, url
    let alonzo = FILES.alonzo

  describe('alonzo', () => {
    let fruitmix, app, token, home, url
    let alonzo = FILES.alonzo

    beforeEach(async function () {
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

      await new Promise((res, rej) => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach('alonzo.jpg', alonzo.path, JSON.stringify({
            op: 'newfile',
            size: alonzo.size,
            sha256: alonzo.hash
          }))
          .expect(200)
          .end(err => err ? rej(err) : res())
      })

      await Promise.delay(500)
    })

    it('get (no alt), 922ffdcc', done => {
      request(app.express)
        .get(`/media/${alonzo.hash}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal({
            type: 'JPEG',
            w: 235,
            h: 314,
            size: alonzo.size
          })
          done()
        })
    }) 

    it('get (alt = metadata)', done => {
      request(app.express)
        .get(`/media/${alonzo.hash}`)
        .set('Authorization', 'JWT ' + token)
        .query({ alt: 'metadata' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal({
            type: 'JPEG',
            w: 235,
            h: 314,
            size: alonzo.size
          })
          done()
        })
    })

    it('get (alt = data)', done => {
      request(app.express)
        .get(`/media/${alonzo.hash}`)
        .set('Authorization', 'JWT ' + token)
        .query({ alt: 'data' })
        .expect(200)
        .buffer()
        .end((err, res) => {
          if (err) return done(err)
          expect(crypto.createHash('sha256').update(res.body).digest('hex')).to.equal(alonzo.hash)
          done()
        })
    })

    it('get thumbnail, 160 x 160 should return 160 x 120', done => {
      request(app.express) 
        .get(`/media/${alonzo.hash}`)
        .set('Authorization', 'JWT ' + token)
        .query({ 
          alt: 'thumbnail',
          width: 160,
          height: 160
        })
        .buffer()
        .end((err, res) => {
          if (err) return done(err)
          let file = path.join(tmptest, 'tmpfile')
          fs.writeFileSync(file, res.body)
          let size = sizeOf(file)
          expect(size).to.deep.equal({ height: 160, width: 120, type: 'jpg' })
          done()
        })
    })

    it('get thumbnail, 160 x should return 160 x ', done => {
      request(app.express) 
        .get(`/media/${alonzo.hash}`)
        .set('Authorization', 'JWT ' + token)
        .query({ 
          alt: 'thumbnail',
          width: 160
        })
        .buffer()
        .end((err, res) => {
          if (err) return done(err)
          let file = path.join(tmptest, 'tmpfile')
          fs.writeFileSync(file, res.body)
          let size = sizeOf(file)
          expect(size.width).to.equal(160)
          done()
        })
    })

    it('get thumbnail, x 160 should return x 160', done => {
      request(app.express) 
        .get(`/media/${alonzo.hash}`)
        .set('Authorization', 'JWT ' + token)
        .query({ 
          alt: 'thumbnail',
          height: 160
        })
        .buffer()
        .end((err, res) => {
          if (err) return done(err)
          let file = path.join(tmptest, 'tmpfile')
          fs.writeFileSync(file, res.body)
          let size = sizeOf(file)
          expect(size.height).to.equal(160)
          done()
        })
    })

  })
})
