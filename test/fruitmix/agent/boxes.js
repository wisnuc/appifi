const path = require('path')
const request = require('supertest')
const superagent = require('superagent')
const Promise = require('bluebird')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const app = require('src/fruitmix/app')
const { saveObjectAsync } = require('src/fruitmix/lib/utils')
const broadcast = require('src/common/broadcast')

const User = require('src/fruitmix/models/user')
const Box = require('src/fruitmix/box/box')

const {
  IDS,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync,
} = require('./lib')

const retrieveWxTokenAsync = async username => {

  let token = await retrieveTokenAsync(username)

  let res = await request(app)
    .get('/wxtoken')
    .set('Authorization', 'JWT ' + token)
    .expect(200)

  return res.body.token
}


const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')

/**
Reset directories and reinit User module
*/
const resetAsync = async() => {

  broadcast.emit('FruitmixStop')

  await broadcast.until('UserDeinitDone', 'BoxDeinitDone')

  await rimrafAsync(tmptest) 
  await mkdirpAsync(tmpDir) 
 
  broadcast.emit('FruitmixStart', 'tmptest') 

  await broadcast.until('UserInitDone', 'BoxInitDone')
}

describe(path.basename(__filename), () => {

  describe('No user', () => {

    beforeEach(async () => {
      await resetAsync()
    })

    it('should fail auth if no token', done => {
      request(app)
        .get('/boxes')
        .expect(401)
        .end(done)
    })
  })

  describe('Alice, with token and unionId', () => {

    let token
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserUnionIdAsync('alice')
      token = await retrieveTokenAsync('alice')
    })

    it("GET /wxtoken", done => {
      request(app)
        .get('/wxtoken')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.token).to.be.an('string')
          done() 
        })
    })

    it("POST /wxtoken/decode", done => {

      request(app)
        .get('/wxtoken')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let token = res.body.token
          request(app)
            .post('/wxtoken/decode')
            .set('Authorization', 'JWT ' + token)
            .send({ token })
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.unionId).to.equal(IDS.alice.unionId)
              done()
            })
        })
    })
  })

  describe('Alice, with token, unionId, and wxtoken', () => {
    let token, wxtoken, boxUUID = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserUnionIdAsync('alice')
      token = await retrieveTokenAsync('alice')
      wxtoken = await retrieveWxTokenAsync('alice')
      sinon.stub(UUID, 'v4').returns(boxUUID)
    })

    afterEach(() => UUID.v4.restore())

    it("GET /boxes should return []", done => {
      request(app)
        .get('/boxes')
        .set('Authorization', 'JWT ' + wxtoken + ' ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })

    it("POST /boxes with no user", done => {
      request(app)
        .post('/boxes')
        .send({ name: 'hello', users: [] })
        .set('Authorization', 'JWT ' + wxtoken + ' ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal({
            uuid: boxUUID,
            name: 'hello',
            owner: IDS.alice.unionId,
            users: []
          }) 
          done()
        })
    }) 
  })
})

