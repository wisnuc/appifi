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

/**

- 400 if uuid is not provided
- 400 if uuid is invalid
+ 200 if hello does not exist

- 403 if hello file uuid mismatch 
+ 200 if hello file does exist
- 403 if hello directory uuid mismatch
+ 200 if hello directory does exist

*/

describe(path.basename(__filename), () => {

  let token, stat
  beforeEach(async () => {
    debug('------ I am a beautiful divider ------')
    await Promise.delay(50)
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
  }) 

  it("400 if uuid is not provided, ba4376fa", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'remove' }))
      .expect(400)
      .end((err, res) => {
        expect(res.body.length).to.equal(1)
        expect(res.body[0].error.status).to.equal(400)
        done()
      })
  })
  
  it("400 if uuid is invalid, 19026923", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'remove', uuid: 'hello' }))
      .expect(400)
      .end((err, res) => {

        expect(res.body.length).to.equal(1)
        expect(res.body[0].error.status).to.equal(400)
        done()
      })
  }) 

  it("200 if hello does not exist, 491cfa1a", done => {
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
        expect(res.body.length).to.equal(1)
        expect(res.body[0].data).to.be.null
        done()
      })
  })

  it("403 if hello file uuid mismatch, 8eabab6b", done => {
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

        let helloUUID = res.body[0].data.uuid
        request(app)   
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({
            op: 'remove',
            uuid: '18291fc7-787e-45d3-a1c6-30d130445c4f'
          }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.length).to.equal(1)
            expect(res.body[0].error.status).to.equal(403)
            done()
          })
      })
  })

  it("200 if hello file does exist, 207c3b6b", done => {
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
        let helloUUID = res.body[0].data.uuid
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
            expect(res.body.length).to.equal(1)
            expect(res.body[0].data).to.be.null
            done()
          })
      })
  })

  it("403 if hello directory uuid mismatch, 30c8c07f", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        let helloUUID = res.body[0].data.uuid
        request(app)   
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({
            op: 'remove',
            uuid: '18291fc7-787e-45d3-a1c6-30d130445c4f'
          }))
          .expect(403)
          .end((err, res) => {
            expect(res.body.length).to.equal(1)
            expect(res.body[0].error.status).to.equal(403)
            done()
          })
      })
  })

  it("200 if hello directory does exist, f2ade8e5", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        let helloUUID = res.body[0].data.uuid
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
            expect(res.body.length).to.equal(1)
            expect(res.body[0].data).to.be.null
            done()
          })
      })
  })

})
