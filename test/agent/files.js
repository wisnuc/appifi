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
    it("GET /drives/:home/dirs should return [alice.home]", done => {

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
    it("GET /drives/:home/dirs/:home should return { path: [alice.home], entries: [] }", done => {

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
          if (err) return done(err)
          expect(res.body).to.deep.equal({
            path: [root],
            entries: []
          })
          done()
        })
    })

    it("try a media file 01", done => {
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

                // console.log(res.body.entries[0])

                expect(res.body.entries[0].metadata).to.deep.equal({
                  m: 'JPEG', 
                  w: 235, 
                  h: 314, 
                  size: 39499
                })
                done()
              }), 1000)
          
        })
    })

    it("try a media file 02", done => {
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
              }), 1000)
          
        })
    })

  })

  /**
  test mkdir

  + target name does not exist.
  + target name exists. target is directory.
  - target name exists. target is file.
  */
  describe("Alice w/ empty home, writedir - mkdir", () => {

    let token, stat
    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')
      await Promise.delay(50)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
    }) 

    it("should succeed when target does not exist", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          let dirPath = path.join(DrivesDir, IDS.alice.home, 'hello')
          fs.lstat(dirPath, (err, stat) => {
            if (err) return done(err)
            expect(stat.isDirectory()).to.be.true
            done()
          })
        }))

    it("should succeed when target is an existing directory", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          let dirPath = path.join(DrivesDir, IDS.alice.home, 'hello')
          fs.lstat(dirPath, (err, stat) => {
            if (err) return done(err)
            expect(stat.isDirectory()).to.be.true
            done()
          })
        }))

    it("should fail when target is an existing file", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('hello', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(403)
        .end((err, res) => {
          expect(res.body.code).to.equal('EEXIST')
          expect(res.body.where).to.be.an('object')
          done()
        }))

  })

  /**
  */
  describe("test rename", () => {

  })

  /**
  */
  describe("test remove", () => {
  })

  describe("Alice w/ empty home, writedir", () => {

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
    it("POST .../entries, mkdir hello and rename to world should success", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello|world', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {
          let helloPath = path.join(DrivesDir, IDS.alice.home, 'hello')
          let worldPath = path.join(DrivesDir, IDS.alice.home, 'world')
          fs.lstat(helloPath, err => {
            expect(err.code).to.equal('ENOENT')
            expect(fs.lstatSync(worldPath).isDirectory()).to.be.true
            done()
          })
        }))

    // mkdir hello and remove
    it("POST .../entries, mkdir hello and remove should success", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello', JSON.stringify({ op: 'remove' }))
        .expect(200)
        .end((err, res) => {
          let helloPath = path.join(DrivesDir, IDS.alice.home, 'hello')
          fs.lstat(helloPath, err => {
            expect(err.code).to.equal('ENOENT')
            done()
          })
        }))

    // upload empty file
    it("POST .../entries, upload empty file only", done =>
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .expect(200)
        .end((err, res) => {
          let filePath = path.join(DrivesDir, IDS.alice.home, 'empty')
          let stat = fs.lstatSync(filePath)
          let attr = JSON.parse(xattr.getSync(filePath, 'user.fruitmix'))
          expect(stat.isFile()).to.be.true
          expect(attr.hash).to.equal(FILES.empty.hash)
          expect(attr.magic).to.equal(0)

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        }))  

    // upload empty file and mkdir name conflict 
    it("POST .../entries, upload empty file and mkdir empty should fail", done =>
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .field('empty', JSON.stringify({ op: 'mkdir' }))
        .expect(500)
        .end((err, res) => {

          let filePath = path.join(DrivesDir, IDS.alice.home, 'empty')
          let stat = fs.lstatSync(filePath)
          let attr = JSON.parse(xattr.getSync(filePath, 'user.fruitmix'))
          expect(stat.isFile()).to.be.true
          expect(attr.hash).to.equal(FILES.empty.hash)
          expect(attr.magic).to.equal(0)

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        }))  

    // upload empty file and rename
    it("POST .../entries, upload empty file and rename to zero", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .field('empty|zero', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {

          let emptyPath = path.join(DrivesDir, IDS.alice.home, 'empty')
          let zeroPath = path.join(DrivesDir, IDS.alice.home, 'zero')

          fs.lstat(emptyPath, err => {
            expect(err.code).to.equal('ENOENT')

            let stat = fs.lstatSync(zeroPath)
            let attr = JSON.parse(xattr.getSync(zeroPath, 'user.fruitmix'))
            expect(stat.isFile()).to.be.true
            expect(attr.hash).to.equal(FILES.empty.hash)
            expect(attr.magic).to.equal(0)

            request(app)
              .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
              .set('Authorization', 'JWT ' + token)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                done()
              })
            // done()
          })
        }))

    it("POST .../entries, upload alonzo file only", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        }))

    it("POST .../entries, upload alonzo file twice", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {

          request(app)
            .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
            .set('Authorization', 'JWT ' + token)
            .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash
            }))
            .expect(200)
            .end((err, res) => {

              request(app)
                .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
                .set('Authorization', 'JWT ' + token)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)
                  done()
                })
            })

/**
          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
**/
        }))

    it('POST .../entries, upload alonzo file and rename to church', done => 
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

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        }))

    it('POST .../entries, upload alonzo file and append alonzo', done =>
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
        }))
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
          append: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })

        }))

  })


})

