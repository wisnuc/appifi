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

const debug = require('debug')('test-newfile')
const divide = require('debug')('divider')

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

  /**
  test newfile

  1. name
  2. filename (json => js obj)
    1. size
    2. sha256

  suppose name and filename are valid.

  - 400 size not provided
  - size is string
  - size is -1
  - size is 1G + 1
  - size is 99.99
  - sha256 not provided
  - sha256 is not valid sha256 string

  - sha256 is 'hello' (invalid ...)

  overwrite not provided

    name does not exist

    + empty file
    - empty file with wrong size ???
    + empty file with wrong sha256

    + non-empty file
    - non-empty file with wrong size
    - non-empty file with wrong sha256

    name does exist

    - empty file    
    - non-empty file

  overwrite provided

  - overwrite invalid (not uuid)
  - name does not exist.
  - name is a directory.
  - name has different uuid than overwrite

  + overwrite empty file with empty file
  
  + overwrite empty file with non-empty file
    - overwrite empty file with non-empty file, wrong size
    - overwrite empty file with non-empty file, wrong hash
  + overwrite non-empty file with empty file
  + overwrite non-empty file with non-empty file
    - overwrite non-empty file with non-emtpy file, wrong size
    - overwrite non-empty file with non-empty file, wrong hash

  x empty file with wrong size
  ? empty file with wrong sha256

  */
  describe("test new file", () => {

    let token, stat
    const REQ = () => request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)

    const J = obj => JSON.stringify(obj)

    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
    }) 

    it('should fail 400 if size not provided, cfd1934f', done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({ sha256: FILES.alonzo.hash }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)

          debug(res.body)

          done()
        })
    })

    it('should fail 400 if size is string, d7bfbbdf', done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({ 
          size: 'hello',
          sha256: FILES.alonzo.hash 
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it('should fail 400 if size is -1, 5c81ce79', done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({ 
          size: -1,
          sha256: FILES.alonzo.hash 
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it('should fail 400 if size is 99.99, f1d9467d', done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({ 
          size: 99.99,
          sha256: FILES.alonzo.hash 
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it('should fail 400 if size is 1G + 1, cc1b82f7', done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({ 
          size: 1024 * 1024 * 1024 + 1,
          sha256: FILES.alonzo.hash 
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it('should fail 400 if sha256 is not provided, 1a29713c', done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({ 
          size: FILES.alonzo.size,
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("should fail 400 if sha256 is 'hello', ecbd247a", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({ 
          size: FILES.alonzo.size,
          sha256: 'hello'
        }))
        .expect(400)
        .end((err, res) => err ? done(err) : (debug(res.body), done()))
    })

    it("should succeed for empty file, fc376f5c", done => {
      REQ()
        .attach('empty', 'testdata/empty', J({
          size: FILES.empty.size,
          sha256: FILES.empty.hash
        }))
        .expect(200)
        .end((err, res) => {
          // if (err) return done(err)
  
          console.log(err, res.body)

          let filePath = path.join(DrivesDir, IDS.alice.home, 'empty')
          let stat = fs.lstatSync(filePath)
          let attr = JSON.parse(xattr.getSync(filePath, 'user.fruitmix'))
          expect(stat.isFile()).to.be.true
          expect(attr.hash).to.equal(FILES.empty.hash)
          expect(attr.magic).to.equal(0)
          done()
        })
    })

    it("should succeed for empty file without sha256", done => {
      REQ()
        .attach('empty', 'testdata/empty', J({ size: FILES.empty.size }))
        .expect(200)
        .end((err, res) => {

          let filePath = path.join(DrivesDir, IDS.alice.home, 'empty')
          let stat = fs.lstatSync(filePath)
          let attr = JSON.parse(xattr.getSync(filePath, 'user.fruitmix'))
          expect(stat.isFile()).to.be.true
          expect(attr.hash).to.equal(FILES.empty.hash)
          expect(attr.magic).to.equal(0)
          done()
        })
    })

    it("should succeed for empty file with wrong sha256", done => {
      REQ()
        .attach('empty', 'testdata/empty', J({
          size: FILES.empty.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {

          let filePath = path.join(DrivesDir, IDS.alice.home, 'empty')
          let stat = fs.lstatSync(filePath)
          let attr = JSON.parse(xattr.getSync(filePath, 'user.fruitmix'))
          expect(stat.isFile()).to.be.true
          expect(attr.hash).to.equal(FILES.empty.hash)
          expect(attr.magic).to.equal(0)
          done()
        })
    })

    it("should succeed for non-empty file", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200) 
        .end(done)
    })

    it("should fail 400 for non-empty file with wrong size (-)", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size - 100,
          sha256: FILES.alonzo.hash
        }))
        .expect(400) 
        .end(done)
    })

    it("should fail 400 for non-empty file with wrong size (+)", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size + 100,
          sha256: FILES.alonzo.hash
        }))
        .expect(400) 
        .end(done)
    })

    it("should fail 403 for empty file with existing file", function (done) {
      REQ()
        .attach('empty', 'testdata/empty', J({
          size: FILES.empty.size,
          sha256: FILES.empty.hash
        }))
        .expect(200)
        .end((err, res) => err ? done(err) : REQ()
          .attach('empty', 'testdata/empty', J({
            size: FILES.empty.size,
            sha256: FILES.empty.hash 
          }))
          .expect(403)
          .end(done)) // TODO
    })

    it("should fail 403 for non-empty file with existing file", function (done) { 
      this.timeout(10000)
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => err ? done(err) : REQ()
          .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
            size: FILES.alonzo.size,
            sha256: FILES.alonzo.hash 
          }))
          .expect(403)
          .end(done)) // TODO
    })

    it("should fail 400 for invalid overwrite 'hello'", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
          overwrite: 'hello'
        }))
        .expect(400) 
        .end(done)
    })

    it("should fail 403 if name does not exist", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          
          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('alonzo2.jpg', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash,
              overwrite: uuid   
            }))
            .expect(403)
            .end(done)
        })
    })

    it("should fail 403 if name is a directory", done => {
      REQ()
        .field('alonzo.jpg', J({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash,
            }))
            .expect(403)
            .end(done)
        })
    })

    it("should fail 403 if name has different uuid than overwrite", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          
          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash,
              overwrite: '2faf6bba-ca2d-413d-89bb-e8cac1797008' 
            }))
            .expect(403)
            .end(done)
        })
    })

    it("should overwrite empty file with empty file", function (done) {
      this.timeout(10000)
      REQ()
        .attach('empty', 'testdata/empty', J({
          size: FILES.empty.size,
          sha256: FILES.empty.hash,
        }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)
          let uuid = res.body.entries[0].uuid

          REQ()
            .attach('empty', 'testdata/empty', J({
              size: FILES.empty.size,
              sha256: FILES.empty.hash,
              overwrite: uuid
            }))
            .expect(200)
            .end(done)
        })
    })

    it("should overwrite empty file with non-empty file", function (done) {
      this.timeout(10000)
      REQ()
        .attach('empty', 'testdata/empty', J({
          size: FILES.empty.size,
          sha256: FILES.empty.hash,
        }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)

          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('empty', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash,
              overwrite: uuid
            }))
            .expect(200)
            .end(done)
        })
    })

    it("should fail 400 overwriting empty file with non-empty file, wrong size", function (done) {
      this.timeout(10000)
      REQ()
        .attach('empty', 'testdata/empty', J({
          size: FILES.empty.size,
          sha256: FILES.empty.hash,
        }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)

          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('empty', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size + 100,
              sha256: FILES.alonzo.hash,
              overwrite: uuid
            }))
            .expect(400)
            .end(done)
        })
    })

    it("should fail 400 overwriting empty file with non-empty file, wrong hash", function (done) {
      this.timeout(10000)
      REQ()
        .attach('empty', 'testdata/empty', J({
          size: FILES.empty.size,
          sha256: FILES.empty.hash,
        }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)

          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('empty', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size,
              sha256: FILES.hello.hash,
              overwrite: uuid
            }))
            .expect(400)
            .end(done)
        })
    })

    it("should overwrite non-empty file with empty file", function (done) {
      this.timeout(10000)
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
        }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)

          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('alonzo.jpg', 'testdata/empty', J({
              size: FILES.empty.size,
              sha256: FILES.empty.hash,
              overwrite: uuid
            }))
            .expect(200)
            .end(done)
        })
    })

    it("should overwrite non-empty file with non-empty file", function (done) {
      this.timeout(10000)
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
        }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)

          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('alonzo.jpg', 'testdata/hello', J({
              size: FILES.hello.size,
              sha256: FILES.hello.hash,
              overwrite: uuid
            }))
            .expect(200)
            .end(done)
        })
    })

    it("should fail 400 when overwriting non-empty file with non-empty file, wrong size", function (done) {
      this.timeout(10000)
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
        }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)

          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('alonzo.jpg', 'testdata/hello', J({
              size: FILES.hello.size + 100,
              sha256: FILES.hello.hash,
              overwrite: uuid
            }))
            .expect(400)
            .end(done)
        })
    })

    it("should fail 400 when overwriting non-empty file with non-empty file, wrong hash", function (done) {
      this.timeout(10000)
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
        }))
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)

          let uuid = res.body.entries[0].uuid
          REQ()
            .attach('alonzo.jpg', 'testdata/hello', J({
              size: FILES.hello.size,
              sha256: FILES.world.hash,
              overwrite: uuid
            }))
            .expect(400)
            .end(done)
        })
    })
  
  })

})

