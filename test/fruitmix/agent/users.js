const path = require('path')
const request = require('supertest')
const superagent = require('superagent')
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
const User = require('src/fruitmix/user/user')

const userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const usersPath = path.join(tmptest, 'users.json')

const createFirstUser = callback => 
  request(app)
    .post('/users')
    .send({
      username: 'hello',
      password: 'world'
    })
    .end((err, res) => {
      if (err) return callback(err)
      callback(null, res.body) 
    })

const createFirstUserAsync = Promise.promisify(createFirstUser)

const firstUserRetrieveToken = callback => 
  request(app)
    .get('/token')
    .auth(userUUID, 'world')
    .end((err, res) => {
      if (err) return callback(err)
      callback(null, res.body.token)
    })

const firstUserRetrieveTokenAsync = Promise.promisify(firstUserRetrieveToken)

describe(path.basename(__filename), () => {

  describe('no users', () => {

    const firstUser = { 
      uuid: userUUID,
      username: 'hello',
      isFirstUser: true,
      isAdmin: true,
      avatar: null,
      unionId: null 
    }

    beforeEach(async () => {
      await rimrafAsync(tmptest) 
      await mkdirpAsync(tmptest) 
      await User.initAsync(usersPath, tmptest)
      sinon.stub(UUID, 'v4').returns(userUUID)
    })

    afterEach(() => {
      UUID.v4.restore()
    })

    it('GET /users should return []', done => 
      request(app)
        .get('/users')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        }))

    it('POST /users should create first user', done =>
      request(app)
        .post('/users')
        .send({
          username: 'hello',
          password: 'world'
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal(firstUser)
          done()
        }))
  })

  describe('first user retrieve token', () => {

    let firstUser

    beforeEach(async () => {

      await rimrafAsync(tmptest) 
      await mkdirpAsync(tmptest) 
      await User.initAsync(usersPath, tmptest)
      sinon.stub(UUID, 'v4').returns(userUUID)
      firstUser = await createFirstUserAsync() 
      UUID.v4.restore()
      if (firstUser.uuid !== userUUID) {
        console.log(`expected user uuid: ${userUUID}`)
        console.log(`real user uuid: ${firstUser.uuid}`)
        throw new Error('user uuid mismatch')
      }
    })

    it('GET /token should succeed', done => {
      request(app)
        .get('/token')
        .auth(firstUser.uuid, 'world')
        .expect(200)
        .end((err, res) => {
          console.log(err || res.body)
          done(err)
        })
    })

    it('GET /token should fail', done => {
      request(app)
        .get('/token')
        .auth(firstUser.uuid, 'hello')
        .expect(401)
        .end(done)
    })
  })

  describe('first user verify token', () => {

    let firstUser
    let token

    beforeEach(async () => {

      await rimrafAsync(tmptest) 
      await mkdirpAsync(tmptest) 
      await User.initAsync(usersPath, tmptest)

      sinon.stub(UUID, 'v4').returns(userUUID)
      firstUser = await createFirstUserAsync() 
      UUID.v4.restore()

      if (firstUser.uuid !== userUUID) {
        console.log(`expected user uuid: ${userUUID}`)
        console.log(`real user uuid: ${firstUser.uuid}`)
        throw new Error('user uuid mismatch')
      }

      token = await firstUserRetrieveTokenAsync() 
    })

    it('GET /token/verify should succeed', done => 
      request(app)
        .get('/token/verify')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end(done))

    it('GET /token/verify should fail with wrong token', done => 
      request(app)
        .get('/token/verify')
        .set('Authorization', 'JWT ' + token.toUpperCase())
        .expect(401)
        .end(done))

  })

  
})


