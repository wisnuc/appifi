const Promise = require('bluebird')
const path = require('path')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const {
  IDS,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync
} = require('./lib')

const app = require('src/app')
const broadcast = require('src/common/broadcast')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(cwd, 'tmp')

const resetAsync = async () => {
  broadcast.emit('FruitmixStop')
  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)
  await mkdirpAsync(path.join(tmptest, 'drives', IDS.alice.home,'haha', 'you', 'and', 'me'))
  broadcast.emit('FruitmixStart', tmptest)
  await broadcast.until('FruitmixStarted')
}


describe(path.basename(__filename), () => {

  let token

  beforeEach(async () => {
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    await new Promise((resolve, reject) => {
      // for 1.jpg
      let size = 190264
      let sha256 = 'ec73573659424a860569e60e0f5ff97b23c7bfb329f53329f6a49b8d1712baae'

      let url = `/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`
      request(app)
        .post(url)
        .set('Authorization', 'JWT ' + token)
        .attach('1.jpg', 'testdata/1.jpg', JSON.stringify({ size, sha256 }))
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve())
    })

    await new Promise((resolve, reject) => {
      request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => err ? reject(err) : resolve())
    })

    // this delay is required for generating metadata
    await Promise.delay(500)
  })

  it('Get Drive List, 16d56af0', done => {
    let url = `/drives/${IDS.alice.home}/dirs/${IDS.alice.home}?counter=true`
    request(app)
      .get(url)
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        console.log(res.body)
        done()
      })
  })
})