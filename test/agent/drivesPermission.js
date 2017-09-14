const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const request = require('supertest')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const xattr = Promise.promisifyAll(require('fs-xattr'))
const UUID = require('uuid')
const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const debug = require('debug')('divider')

const app = require('src/app')
const { saveObjectAsync } = require('src/lib/utils')
const broadcast = require('src/common/broadcast')
const createBigFile = require('src/utils/createBigFile')

const getFruit = require('src/fruitmix')

const {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync
} = require('./lib')


const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')
const DrivesDir = path.join(tmptest, 'drives')

const resetAsync = async () => {

  broadcast.emit('FruitmixStop')

  await Promise.delay(500)
  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)
  broadcast.emit('FruitmixStart', tmptest)
  await broadcast.until('FruitmixStarted')
}


describe(path.basename(__filename), () => {

  describe("Alice empty home", () => {

    let aliceToken, bobToken, stat
    image1Size = 190264
    let image1 = {
      m: 'JPEG',
      w: 1200,
      h: 800,
      size: 190,
      hash: 'ec73573659424a860569e60e0f5ff97b23c7bfb329f53329f6a49b8d1712baae'
    }
    image2Size = 201090
    let image2 = {
      m: 'JPEG',
      w: 1200,
      h: 800,
      size: 201,
      hash: '2c4dfc6c9108dc1e0b79112e00a9431e4cdd1282813a4df9b4ec77d4fb5e08db'
    }
    image3Size = 21834
    let image3 = {
      m: 'JPEG',
      w: 1200,
      h: 800,
      size: 21,
      hash: '88f5217cac2322e810990547708f17c3c8af4ea013b8b4cadbf1822333b8e5bd'
    }

    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')
      await Promise.delay(50)
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
      stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
      // this delay is required for generating metadata
      await Promise.delay(500)
    })

    it("GET dirs should return [alice.home]", done => {

      // array of (mapped) dir object
      let expected = [{
        uuid: IDS.alice.home,
        parent: '',
        name: IDS.alice.home,
        mtime: stat.mtime.getTime(),
      }]

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs`)
        .set('Authorization', 'JWT ' + aliceToken)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal(expected)
          done()
        })
    })

    it("Alice get Bob dirs should return 401", done => {
      request(app)
        .get(`/drives/${IDS.alice.home}/dirs`)
        .set('Authorization', 'JWT ' + bobToken)
        .expect(401)
        .end((err, res) => {
          if (err) return done(err)
          done()
        })
    })

    it("Alice upload Bob dirs should return 401", done => {
      let size = image2Size
      let sha256 = image2.hash

      let url = `/drives/${IDS.bob.home}/dirs/${IDS.bob.home}/entries`
      request(app)
        .post(url)
        .set('Authorization', 'JWT ' + aliceToken)
        .attach('2.jpg', 'testdata/2.jpg', JSON.stringify({ size, sha256 }))
        .expect(401)
        .end((err, res) => err ? done(err) : done())
    })

    it("Alice download Bob file should return 401", done => {
      let url = `/drives/${IDS.bob.home}/dirs/${IDS.bob.home}/entries/${ image1.hash }`
      request(app)
        .get(url)
        .set('Authorization', 'JWT ' + aliceToken)
        .expect(401)
        .end((err, res) => err ? done(err) : done())
    })

    it("Alice upload file should success", done => {
      let size = image3Size
      let sha256 = image3.hash

      let url = `/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`
      request(app)
        .post(url)
        .set('Authorization', 'JWT ' + aliceToken)
        .attach('3.jpg', 'testdata/3.jpg', JSON.stringify({ size, sha256 }))
        .expect(200)
        .end((err, res) => err ? done(err) : done())
    })


    describe("public drive permission test", () => {
      beforeEach(async () => {
        let props = {
          writelist: [IDS.bob.uuid],
          label: 'hello'
        }
        await createPublicDriveAsync(props, aliceToken, IDS.publicDrive1.uuid)

        await new Promise((resolve, reject) => {

          // for 1.jpg
          let size = image3Size
          let sha256 = image3.hash

          let url = `/drives/${IDS.publicDrive1.uuid}/dirs/${IDS.publicDrive1.uuid}/entries`
          request(app)
            .post(url)
            .set('Authorization', 'JWT ' + bobToken)
            .attach('3.jpg', 'testdata/3.jpg', JSON.stringify({ size, sha256 }))
            .expect(200)
            .end((err, res) => err ? reject(err) : resolve())
        })
        // this delay is required for generating metadata
        await Promise.delay(500)

      })

      it("Alice upload to public drive return 401", done => {
        let size = image2Size
        let sha256 = image2.hash

        let url = `/drives/${IDS.publicDrive1.uuid}/dirs/${IDS.publicDrive1.uuid}/entries`
        request(app)
          .post(url)
          .set('Authorization', 'JWT ' + aliceToken)
          .attach('2.jpg', 'testdata/2.jpg', JSON.stringify({ size, sha256 }))
          .expect(401)
          .end((err, res) => err ? done(err) : done())
      })

      it("Alice get public drive file return 401", done => {
        let url = `/drives/${ IDS.publicDrive1.uuid }/dirs/${ IDS.publicDrive1.uuid }/entries/${ image2.hash }`
        request(app)
          .get(url)
          .set('Authorization', 'JWT ' + aliceToken)
          .expect(401)
          .end((err, res) => err ? done(err) : done())
      })

      it("bob get public drive file return 200", done => {

        let url = `/drives/${ IDS.publicDrive1.uuid }/dirs/${ IDS.publicDrive1.uuid }/entries/${ image3.hash }?name=3.jpg`
        request(app)
          .get(url)
          .set('Authorization', 'JWT ' + bobToken)
          .expect(200)
          .end((err, res) => err ? done(err) : done())
      })
    })


  })


})  