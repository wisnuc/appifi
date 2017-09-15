const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const crypto = require('crypto')

const request = require('supertest')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const sizeOf = require('image-size')
const UUID = require('uuid')

const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const shoud = chai.should()

const debug = require('debug')('divider')

const app = require('src/app')
const broadcast = require('src/common/broadcast')

const Forest = require('src/forest/forest')
// const Media = require('src/media/media')

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
  describe("no user", () => {
    beforeEach(async () => {
      await resetAsync() 
    })

    it("create Alice is firstUser, set username password", done => {
      stubUserUUID('alice')
      request(app)
        .post('/users')
        .send({ username: 'alice', password: 'alice' })
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          expect(res.body).to.be.deep.equal({
            uuid: IDS.alice.uuid,
            username: 'alice',
            isFirstUser: true,
            isAdmin: true,
            avatar: null,
            global: null,
            disabled: false
          })
          UUID.v4.restore()
          done()
        })
    })

    it("create Alice is firstUser, avator not allow", done => {
      request(app)
      .post('/users')
      .send({ username: 'alice', password: 'alice', avatar:'www.baidu.com'})
      .expect(400)
      .end((err, res) => err ? done(err) : done())
    })

    it("create Alice is firstUser, disabled not allow", done => {
      request(app)
      .post('/users')
      .send({ username: 'alice', password: 'alice', disabled: true})
      .expect(400)
      .end((err, res) => err ? done(err) : done())
    })
  })

  describe("Alice is superuser, Bob is admin, charlie is common user", () => {
    let aliceToken, bobToken, charlieToken
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice') 
      aliceToken = await retrieveTokenAsync('alice')
      // alice create
      await createUserAsync('bob', aliceToken, true)
      bobToken = await retrieveTokenAsync('bob')
      // bob create
      await createUserAsync('charlie', aliceToken, false)
      bobToken = await retrieveTokenAsync('charlie')
    })

    
  })
})