const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const crypto = require('crypto')

const request = require('supertest')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const sizeOf = require('image-size')

const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const shoud = chai.should()

const debug = require('debug')('divider')

const app = require('src/app')
const broadcast = require('src/common/broadcast')

const Forest = require('src/forest/forest')
const Media = require('src/media/media')

const {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync
} = require('test/agent/lib')


const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')

const resetAsync = async () => {
  broadcast.emit('FruitmixStop')
  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)
  broadcast.emit('FruitmixStart', tmptest) 
  await broadcast.until('FruitmixStarted')
}

describe(path.basename(__filename), () => {

  describe("alice, empty", () => {

    let token

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice') 
    })

    it("Media List should return []", done => {
      request(app)
        .get(`/media`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })
  })

  describe("alice, single media file vpai001.jpg", () => {

    let token

    const vpai001Fingerprint = '529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb'
    const vpai001Metadata = {
      hash: vpai001Fingerprint,
      m: 'JPEG',
      w: 4624,
      h: 2608,
      orient: 1,
      datetime: '2017:06:17 17:31:18',
      make: 'Sony',
      model: 'G3116',
      lat: '31/1, 10/1, 506721/10000',
      latr: 'N',
      long: '121/1, 36/1, 27960/10000',
      longr: 'E',
      size: 4192863
    }

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')

      token = await retrieveTokenAsync('alice')

      await new Promise((resolve, reject) => {

        // for vpai001.jpg
        let size = vpai001Metadata.size 
        let sha256 = vpai001Fingerprint

        let url = `/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`
        request(app)
          .post(url) 
          .set('Authorization', 'JWT ' + token)
          .attach('vpai001.jpg', 'testdata/vpai001.jpg', JSON.stringify({ size, sha256 }))
          .expect(200)
          .end((err, res) => err ? reject(err) : resolve())
      })

      // this delay is required for generating metadata
      await Promise.delay(500)
    })

    it("all i can view", done => {
      request(app)
        .get('/media')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([vpai001Metadata])
          done()
        })
    })

    it("vpai001 metadata, no query", done => {
      request(app)
        .get(`/media/${vpai001Fingerprint}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let obj = Object.assign({}, vpai001Metadata)
          delete obj.hash
          expect(res.body).to.deep.equal(obj)
          done()
        })
    })

    it("vpai001 data", done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))

      ws.on('close', () => {
        expect(ws.bytesWritten).to.equal(vpai001Metadata.size)
        let data = fs.readFileSync(downloadPath)
        let sha256 = crypto.createHash('sha256').update(data).digest('hex')
        expect(sha256).to.equal(vpai001Fingerprint)
        done()
      })

      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=data`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })

    it("vpai001 thumbnail width 160 and height 160", done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
      ws.on('close', () => {
        expect(sizeOf(downloadPath)).to.deep.equal({ width: 160, height: 90, type: 'jpg' })
        done()
      })
      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=thumbnail&width=160&height=160`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })

    it("vpai001 thumbnail width 160", done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
      ws.on('close', () => {
        expect(sizeOf(downloadPath)).to.deep.equal({ width: 160, height: 90, type: 'jpg' })
        done()
      })
      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=thumbnail&width=160`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })

    it("vpai001 thumbnail height 160", done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
      ws.on('close', () => {
        let dim = sizeOf(downloadPath)
        console.log(dim)
        expect(dim).to.deep.equal({ width: 284, height: 160, type: 'jpg' })
        done()
      })
      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=thumbnail&height=160`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })

    it("vpai001 thumbnail width 160 and height 160 and caret", done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
      ws.on('close', () => {
        expect(sizeOf(downloadPath)).to.deep.equal({ width: 284, height: 160, type: 'jpg' })
        done()
      })
      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=thumbnail&width=160&height=160&modifier=caret`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })

  })
})
