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

const debug = require('debug')('test-files')

const app = require('src/app')
const { saveObjectAsync } = require('src/lib/utils')
const broadcast = require('src/common/broadcast')
const createBigFile = require('src/utils/createBigFile')
const Magic = require('src/lib/magic')

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

  describe("Alice w/ empty home", () => {

    let token, stat
    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')
      await Promise.delay(50)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
    }) 

    // Get directories in alice home drive
    it("GET dirs should return [alice.home], 197f8bd4", done => {

      // array of (mapped) dir object
      let expected = [{
        uuid: IDS.alice.home,
        parent: '',
        name: IDS.alice.home,
        mtime: stat.mtime.getTime(),
      }]

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal(expected)
          done()
        })
    }) 

    // Get a single directory
    it("GET dirs/:home should return { path: [alice.home], entries: [] }, db5a991e", done => {

      let root = {
        uuid: IDS.alice.home,
        name: IDS.alice.home,
        mtime: stat.mtime.getTime()
      }

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {

          console.log(err || res.body)

          if (err) return done(err)
          expect(res.body).to.deep.equal({
            path: [root],
            entries: []
          })
          done()
        })
    })

    // this test fails in #398
    it("metadata should be provided for media file when metadata=true, 0553082f", function (done) {
      this.timeout(5000)

      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('hello', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {
          setTimeout(() => 
            request(app)
              .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}?metadata=true`)
              .set('Authorization', 'JWT ' + token)
              .expect(200)
              .end((err, res) => {
                expect(res.body.entries[0].metadata).to.deep.equal({
                  m: 'JPEG', 
                  w: 235, 
                  h: 314, 
                  size: 39499
                })
                done()
              }), 500)
          
        })
    })

    it("metadata should not be provided for media file when metadata=false", function (done) {
      this.timeout(5000)
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries?metadata=false`)
        .set('Authorization', 'JWT ' + token)
        .attach('hello', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {

          setTimeout(() => 
            request(app)
              .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
              .set('Authorization', 'JWT ' + token)
              .expect(200)
              .end((err, res) => {

                // console.log(res.body.entries[0])

                expect(res.body.entries[0].metadata).to.be.undefined
                done()
              }), 500)
          
        })
    })

  })

  describe("ad hoc", () => {

    let token, stat
    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')
      await Promise.delay(50)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
    }) 
 
    // mkdir hello and rename to world
    it("mkdir hello and rename to world should success, f957d727", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello|world', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)

          let hello = res.body[0].data
          let world = res.body[1].data
          expect(hello.uuid).to.equal(world.uuid)
          expect(world.type).to.equal('directory')
          done()
        })
    })

    it("mkdir with chinese name, 92f28276", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('中文名', JSON.stringify({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          expect(res.body[0].data.name).to.equal('中文名')

          let filePath = path.join(DrivesDir, IDS.alice.home, '中文名')
          fs.stat(filePath, (err, stat) => {
            if (err) return done(err)
            expect(stat.isDirectory()).to.be.true
            done()
          })
        })
    })

    // name conflict 
    it("upload empty file then mkdir empty should fail, 64383a7a", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .field('empty', JSON.stringify({ op: 'mkdir' }))
        .expect(403)
        .end((err, res)=> {
          if (err) return done(err)
          debug(res.body)
          // empty file
          expect(res.body[0].data).to.include({
            type: 'file',
            name: 'empty',
            size: 0,
            magic: Magic.ver,
            hash: FILES.empty.hash
          }).to.have.keys('uuid')
          // mkdir
          expect(res.body[1].error.code).to.equal('EEXIST')
          done()
        })
    })

    // upload empty file and rename
    it("upload empty file and rename to zero, 1542c194", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .field('empty|zero', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)

          expect(res.body[0].data).to.include({
            type: 'file',
            name: 'empty',
            size: 0,
            magic: Magic.ver,
            hash: FILES.empty.hash
          })

          expect(res.body[1].data).to.include({
            type: 'file',
            name: 'zero',
            size: 0,
            magic: Magic.ver,
            hash: FILES.empty.hash
          })

          done()
        })
    })

    it("upload alonzo file only, c57a0973", function (done) {
      this.timeout(5000)
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body) 

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              debug(res.body)

              expect(res.body.entries.length).to.equal(1)
              expect(res.body.entries[0]).to.include({
                type: 'file',
                name: 'alonzo.jpg',
                size: FILES.alonzo.size,
                magic: 'JPEG',
                hash: FILES.alonzo.hash
              }).to.have.keys('mtime')

              done()
            })
        })
    })

    it('upload alonzo and rename to church, 553de6b2', done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .field('alonzo.jpg|church.jpg', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              debug(res.body)

              expect(res.body.entries.length).to.equal(1)
              expect(res.body.entries[0]).to.include({
                type: 'file',
                name: 'church.jpg',
                size: FILES.alonzo.size,
                magic: 'JPEG',
                hash: FILES.alonzo.hash
              }).to.have.keys('mtime')

              done()
            })
        })
    })

  }) // end of ad hoc

})

