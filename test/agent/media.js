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
const { isUUID } = require('src/lib/assertion') 

const Forest = require('src/forest/forest')

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

  describe("alice, single media file vpai001.jpg in home root", () => {

    let token

    const vpai001Fingerprint = '529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb'
    const vpai001Metadata = {
      hash: vpai001Fingerprint,
      m: 'JPEG',
      w: 4624,
      h: 2608,
      orient: 1,
      date: '2017:06:17 17:31:18',
      make: 'Sony',
      model: 'G3116',
      gps: `31 deg 10' 50.67" N, 121 deg 36' 2.80" E`,
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
      await Promise.delay(200)
    })

    it("GET media should return [vpai001 metadata], e1730087", done => {
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

    it("GET vpai001 metadata should return vpai001 metadata (w/o hash), f18469c6", done => {
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

    it("GET vpai001 data should download file, 99734c12", done => {
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

    it("GET vpai001 thumbnail (w/ width 160 and height 160) should match width and height, 5270e6ea", done => {
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

    it("GET vpai001 thumbnail (w/ width 160) should match width and height, 2068b765", done => {
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

    // failing test for #397 (code path coverage)
    it("GET vpai001 thumbnail width 160, twice, a211b567", done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
      ws.on('close', () => {
        expect(sizeOf(downloadPath)).to.deep.equal({ width: 160, height: 90, type: 'jpg' })

        ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
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
      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=thumbnail&width=160`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })

    it("GET vpai001 thumbnail height 160, 783f8bf3", done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
      ws.on('close', () => {
        let dim = sizeOf(downloadPath)
        expect(dim).to.deep.equal({ width: 284, height: 160, type: 'jpg' })
        done()
      })
      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=thumbnail&height=160`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })

    it("GET vpai001 thumbnail width 160 and height 160 and caret, 0eeac2aa", done => {
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

    it("GET vpai001 random, 549dad02", done => {
      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=random`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(isUUID(res.body.key)).to.be.true
          done()
        })
    })

    it("GET vpai001 by random, efb46d50", done => {
      request(app)
        .get(`/media/${vpai001Fingerprint}?alt=random`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let key = res.body.key
          expect(isUUID(key)).to.be.true

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
            .get(`/media/random/${key}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .pipe(ws)
        })
    })

  })

  describe("alice, bob permission test", () => {

    let aliceToken, bobToken

    image1Size = 190264
    let image1 =  { 
      m: 'JPEG',
      w: 1200,
      h: 800,
      size: 190264,
      hash: 'ec73573659424a860569e60e0f5ff97b23c7bfb329f53329f6a49b8d1712baae'
    }
    image2Size = 201090
    let image2 = {
      m: 'JPEG',
      w: 1200,
      h: 800,
      size: 201090,
      hash: '2c4dfc6c9108dc1e0b79112e00a9431e4cdd1282813a4df9b4ec77d4fb5e08db'
    }
    image3Size = 21834
    let image3 =  { 
      m: 'JPEG',
      w: 1200,
      h: 800,
      size: 21834,
      hash: '88f5217cac2322e810990547708f17c3c8af4ea013b8b4cadbf1822333b8e5bd'
    }

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice') 
      aliceToken = await retrieveTokenAsync('alice')
      // await create
      await createUserAsync('bob', aliceToken, true)
      bobToken = await retrieveTokenAsync('bob')

      await new Promise((resolve, reject) => {

        // for 1.jpg
        let size = image1Size
        let sha256 = image1.hash

        let url = `/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`
        request(app)
          .post(url)
          .set('Authorization', 'JWT ' + aliceToken)
          .attach('1.jpg', 'testdata/1.jpg', JSON.stringify({ size, sha256 }))
          .expect(200)
          .end((err, res) => err ? reject(err) : resolve())
      })

      // this delay is required for generating metadata
      await Promise.delay(500)
    })

    it("Media List should return [] for bob", done => {
      request(app)
        .get(`/media`)
        .set('Authorization', 'JWT ' + bobToken)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })

    it("Media List should return [{image1}] for alice, 5b940916", done => {
      request(app)
        .get(`/media`)
        .set('Authorization', 'JWT ' + aliceToken)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([image1])
          done()
        })
    })

    it("Media List should return [{image1}] for alice, and return [{image2}] for bob, d6d82bb9", done => {
      let url = `/drives/${IDS.bob.home}/dirs/${IDS.bob.home}/entries`
      request(app)
        .post(url)
        .set('Authorization', 'JWT ' + bobToken)
        .attach('2.jpg', 'testdata/2.jpg', JSON.stringify({ size:image2Size, sha256:image2.hash }))
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
           setTimeout(function() {
            request(app)
            .get(`/media`)
            .set('Authorization', 'JWT ' + aliceToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body).to.deep.equal([image1])

              request(app)
              .get(`/media`)
              .set('Authorization', 'JWT ' + bobToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                expect(res.body).to.deep.equal([image2])
                done()
              })
            })
           }, 500);
        })
    })

    it("Media get metadata should return 403 for bob", done => {
      request(app)
        .get(`/media/${ image1.hash }`)
        .set('Authorization', 'JWT ' + bobToken)
        .expect(403)
        .end((err, res) => {
          if (err) return done(err)
          done()
        })
    })

    it("Media get metadata should return [image1] for bob, bc441c4c", done => {
      let url = `/drives/${IDS.bob.home}/dirs/${IDS.bob.home}/entries`
      request(app)
        .post(url)
        .set('Authorization', 'JWT ' + bobToken)
        .attach('1.jpg', 'testdata/1.jpg', JSON.stringify({ size:image1Size, sha256:image1.hash }))
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          setTimeout(() => {
            request(app)
            .get(`/media/${ image1.hash }`)
            .set('Authorization', 'JWT ' + bobToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              let obj = Object.assign({}, image1)
              delete obj.hash
              expect(res.body).to.deep.equal(obj)
              done()
            })
          }, 500)
        })
    })

    describe("test for public drive", () => {
      beforeEach(async () => {
        let props = {
          writelist: [IDS.bob.uuid],
          label: 'hello'
        }
        await createPublicDriveAsync(props, aliceToken, IDS.publicDrive1.uuid)

        await new Promise((resolve, reject) => {

          // for 2.jpg
          let size = image2Size
          let sha256 = image2.hash

          let url = `/drives/${IDS.publicDrive1.uuid}/dirs/${IDS.publicDrive1.uuid}/entries`
          request(app)
            .post(url)
            .set('Authorization', 'JWT ' + bobToken)
            .attach('2.jpg', 'testdata/2.jpg', JSON.stringify({ size, sha256 }))
            .expect(200)
            .end((err, res) => err ? reject(err) : resolve())
        })

        // this delay is required for generating metadata
        await Promise.delay(500)
      })

      it("fix media bug to delete duplicate images", done => {
        let size = image2Size
        let sha256 = image2.hash
  
        let url = `/drives/${IDS.bob.home}/dirs/${IDS.bob.home}/entries`
        request(app)
          .post(url)
          .set('Authorization', 'JWT ' + bobToken)
          .attach('2.jpg', 'testdata/2.jpg', JSON.stringify({ size, sha256 }))
          .expect(200)
          .end((err, res) => {
            if(err) return done(err)
              request(app)
                .get(`/media`)
                .set('Authorization', 'JWT ' + bobToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)
                  expect(res.body).to.deep.equal([image2])
                  done()
                })
          })
      })

      it("Media List should return [{image2}] for bob, a7009927", done => {
        request(app)
          .get(`/media`)
          .set('Authorization', 'JWT ' + bobToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body).to.deep.equal([image2])
            done()
          })
      })
      
      it("Media List should return [{image1}] for alice", done => {
        request(app)
          .get(`/media`)
          .set('Authorization', 'JWT ' + aliceToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body).to.deep.equal([image1])
            done()
          })
      })

      it("Media get metadata should return 403 for alice", done => {
        request(app)
          .get(`/media/${ image2.hash }`)
          .set('Authorization', 'JWT ' + aliceToken)
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            done()
          })
      })

      it("Media get thumbnail should return 403 for alice", done => {
        request(app)
          .get(`/media/${ image2.hash }?alt=thumbnail&height=160`)
          .set('Authorization', 'JWT ' + aliceToken)
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            done()
          })
      })
      it("Media get data should return 403 for alice", done => {
        request(app)
          .get(`/media/${ image2.hash }?alt=data`)
          .set('Authorization', 'JWT ' + aliceToken)
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            done()
          })
      })

      it("Media get data should return file for bob", done => {
        let downloadPath = path.join(tmptest, 'downloaded')
        let ws = fs.createWriteStream(downloadPath)
  
        ws.on('close', () => {
          expect(ws.bytesWritten).to.equal(image2Size)
          let data = fs.readFileSync(downloadPath)
          let sha256 = crypto.createHash('sha256').update(data).digest('hex')
          expect(sha256).to.equal(image2.hash)
          done()
        })

        request(app)
          .get(`/media/${ image2.hash }?alt=data`)
          .set('Authorization', 'JWT ' + bobToken)
          .expect(200)
          .pipe(ws)
      })
    })
  })
})


