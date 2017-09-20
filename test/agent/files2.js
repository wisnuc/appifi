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

/**
    // Get directories in alice home drive
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
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal(expected)
          done()
        })
    }) 

    // Get a single directory
    it("GET dirs/:home should return { path: [alice.home], entries: [] }", done => {

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
**/

    // this test fails in #398
    it("metadata should be provided for media file when metadata=true", function (done) {
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

  /**
  test mkdir

  + 200 if hello does not exist.
  + 200 if hello is a directory.
  - 403 if hello is a file.
  */

  /**

  - 400 if uuid is not provided
  - 400 if uuid is invalid
  + 200 if hello does not exist

  - 403 if hello file uuid mismatch 
  + 200 if hello file does exist
  - 403 if hello directory uuid mismatch
  + 200 if hello directory does exist

  */
/**
  describe("test remove", () => {

    let token, stat
    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')
      await Promise.delay(50)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
    }) 
 
    it("400 if uuid is not provided", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'remove' }))
        .expect(400)
        .end(done)
    })
    
    it("400 if uuid is invalid", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'remove', uuid: 'hello' }))
        .expect(400)
        .end(done)
    }) 

    it("200 if hello does not exist", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ 
          op: 'remove', 
          uuid: '49e00ba7-8eb5-4fec-9b19-dd0f0e02caa5' 
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.entries).to.deep.equal([])
          done()
        })
    })

    it("403 if hello file uuid mismatch", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('hello', 'testdata/hello', JSON.stringify({
          size: FILES.hello.size,
          sha256: FILES.hello.hash
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let helloUUID = res.body.entries[0].uuid
          request(app)   
            .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({
              op: 'remove',
              uuid: '18291fc7-787e-45d3-a1c6-30d130445c4f'
            }))
            .expect(403)
            .end(done)
        })
    })

    it("200 if hello file does exist", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('hello', 'testdata/hello', JSON.stringify({
          size: FILES.hello.size,
          sha256: FILES.hello.hash
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let helloUUID = res.body.entries[0].uuid
          request(app)   
            .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({
              op: 'remove',
              uuid: helloUUID
            }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.entries).to.deep.equal([])
              done()
            })
        })
    })

    it("403 if hello directory uuid mismatch", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let helloUUID = res.body.entries[0].uuid
          request(app)   
            .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({
              op: 'remove',
              uuid: '18291fc7-787e-45d3-a1c6-30d130445c4f'
            }))
            .expect(403)
            .end(done)
        })
    })

    it("200 if hello directory does exist", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let helloUUID = res.body.entries[0].uuid
          request(app)   
            .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({
              op: 'remove',
              uuid: helloUUID
            }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.entries).to.deep.equal([])
              done()
            })
        })
    })

  })
**/

/**
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
    it("mkdir hello and rename to world should success", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello|world', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let { type, name } = res.body.entries[0]
          expect({ type, name }).to.deep.equal({
            type: 'directory',
            name: 'world',
          })
          done()
        })
    })

    // name conflict 
    it("upload empty file then mkdir empty should fail", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .field('empty', JSON.stringify({ op: 'mkdir' }))
        .expect(403)
        .end((err, res)=> {
          expect(res.body.code).to.equal('EEXIST')
          done()
        })
    })

    // upload empty file and rename
    it("upload empty file and rename to zero", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .field('empty|zero', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let { type, name, size, magic, hash } = res.body.entries[0]
          expect({ type, name, size, magic, hash }).to.deep.equal({
            type: 'file',
            name: 'zero',
            size: FILES.empty.size,
            magic: 0,
            hash: FILES.empty.hash
          })
          done()
        })
    })

    it("upload alonzo file only", function (done) {
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
          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
    })

    it('upload alonzo and rename to church', done => {
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
          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              expect(res.body.entries.length).to.equal(1)
              let { type, name, size, magic, hash } = res.body.entries[0]

              expect({ type, name, size, magic, hash }).to.deep.equal({
                type: 'file',
                name: 'church.jpg',
                size: FILES.alonzo.size,
                magic: 'JPEG',
                hash: FILES.alonzo.hash
              })
              done()
            })
        })
    })

  }) // end of ad hoc
**/


})

