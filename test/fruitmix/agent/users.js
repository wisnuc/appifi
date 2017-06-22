const Promise = require('bluebird')
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
const broadcast = require('src/common/broadcast')

const User = require('src/fruitmix/models/user')
const Drive = require('src/fruitmix/models/drive')

const {
  IDS,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync
} = require('./lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')

/**
Reset directories and reinit User module
*/
const resetAsync = async () => {

  broadcast.emit('FruitmixStop')

  await broadcast.until('UserDeinitDone', 'DriveDeinitDone')

  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)

  broadcast.emit('FruitmixStart', tmptest) 

  await broadcast.until('UserInitDone', 'DriveInitDone')
}


describe(path.basename(__filename), () => {

  describe('No user', () => {

    beforeEach(async () => {
      await resetAsync()
      stubUserUUID('alice')
    })

    afterEach(() => UUID.v4.restore())

    it('GET /users should return [] (callback)', done => {
      request(app)
        .get('/users')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })

    it('GET /users should return [] (async and eventually)', async() => 
      request(app)
        .get('/users')
        .expect(200)
        .should.eventually.have.deep.property('body')
        .to.deep.equal([]))

    it('POST /users should create alice', async() =>
      request(app)
        .post('/users')
        .send({ username: 'alice', password: 'alice' })
        .expect(200)
        .should.eventually.have.deep.property('body')
        .that.deep.equal({
          uuid: IDS.alice.uuid,
          username: 'alice',
          isFirstUser: true,
          isAdmin: true,
          avatar: null,
          unionId: null 
        }))

  })

  describe('After alice created, retrieve token', () => {

    beforeEach(async () => {
      await resetAsync()  
      await createUserAsync('alice') 
    })

    it('GET /token should fail with wrong password', done => {
      request(app)
        .get('/token')
        .auth(IDS.alice.uuid, 'hello')
        .expect(401)
        .end(done)
    })

    it('GET /token should return token with correct password', done => {
      request(app)
        .get('/token')
        .auth(IDS.alice.uuid, 'alice')
        .expect(200)
        .end(done)
    })
  })

  describe('After alice created', () => {

    let token
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
    })

    it('GET /token/verify should fail without token', done => {
      request(app)
        .get('/token/verify')
        .expect(401)
        .end(done)
    })

    it('GET /token/verify should fail with wrong token', done => {
      request(app)
        .get('/token/verify')
        .set('Authorization', 'JWT ' + token.toUpperCase())
        .expect(401)
        .end(done)
    })

    it('GET /token/verify should succeed', done => {
      request(app)
        .get('/token/verify')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end(done)
    })

    it("GET /drives should return alice's home drive", async() => 
      request(app)
        .get('/drives')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .should.eventually.have.deep.property('body')
        .that.deep.equal([{
          uuid: IDS.alice.home,
          type: 'private',
          owner: IDS.alice.uuid,
          tag: 'home'
        }]))

    // TODO move to other place
    it("PATCH /users/:userUUID alice set unionId", async () =>
      setUserUnionIdAsync('alice')
        .should.eventually.have.deep.property('unionId')
        .that.equal(IDS.alice.unionId))
  })

  describe('After alice created, create bob', () => {

    let token
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stubUserUUID('bob')
    })

    afterEach(() => UUID.v4.restore())

    it ('POST /users should NOT create bob without token', async() => 
      request(app)
        .post('/users')
        .send({ username: 'bob', password: 'bob', isAdmin: true })
        .expect(401))

    it ('POST /users should create bob', async() => 
      request(app)
        .post('/users')
        .send({ username: 'bob', password: 'bob', isAdmin: true })
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .should.eventually.have.deep.property('body')
        .that.deep.equal({
          uuid: IDS.bob.uuid,
          username: 'bob',
          isFirstUser: false,
          isAdmin: true,  
          avatar: null,
          unionId: null
        })) 
  })

  describe('After alice created bob', () => {

    let aliceToken, bobToken
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice') 
      aliceToken = await retrieveTokenAsync('alice')
      await createUserAsync('bob', aliceToken, true)
      bobToken = await retrieveTokenAsync('bob')
    })

    it ("GET /drives should returns ONLY bob home with bob's token", async () => {
      request(app)
        .get('/drives')      
        .set('Authorization', 'JWT ' + bobToken)
        .expect(200)
        .should.eventually.have.deep.property('body')
        .that.deep.equal([{ 
          uuid: IDS.bob.home,
          type: 'private',
          owner: IDS.bob.uuid,
          tag: 'home'
        }])
    })

    it ("GET /drives should returns ONLY alice home with alice's token", async () => {
      request(app)
        .get('/drives')      
        .set('Authorization', 'JWT ' + aliceToken)
        .expect(200)
        .should.eventually.have.deep.property('body')
        .that.deep.equal([{ 
          uuid: IDS.alice.home,
          type: 'private',
          owner: IDS.alice.uuid,
          tag: 'home'
        }])
    })


  })

  describe('After alice created bob, alice creates public drive 1', () => {

    let aliceToken, bobToken

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice') 
      aliceToken = await retrieveTokenAsync('alice')
      await createUserAsync('bob', aliceToken, true)
      bobToken = await retrieveTokenAsync('bob')

      sinon.stub(UUID, 'v4').returns(IDS.publicDrive1.uuid)      
    })

    afterEach(() => UUID.v4.restore())

    it ("POST /drives should create a public drive by alice with bob as user", async () => 
      request(app)
        .post('/drives')
        .send({ writelist: [IDS.bob.uuid], label: 'foobar' })
        .set('Authorization', 'JWT ' + aliceToken)
        .expect(200)
        .should.eventually.have.property('body')
        .to.deep.equal({
          uuid: IDS.publicDrive1.uuid,
          type: 'public',
          writelist: [IDS.bob.uuid],
          readlist: [],
          label: 'foobar'
        }))
  })

  describe('After alice created bob and public drive 1', () => {

    let aliceToken, bobToken

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice') 
      aliceToken = await retrieveTokenAsync('alice')
      await createUserAsync('bob', aliceToken, true)
      bobToken = await retrieveTokenAsync('bob')

      let props = {
        writelist: [IDS.bob.uuid],
        label: 'hello'
      } 
      await createPublicDriveAsync(props, aliceToken, IDS.publicDrive1.uuid)
    })

    it("GET /drives alice should NOT get publicDrive1", async () => 
      request(app)
        .get('/drives')
        .set('Authorization', 'JWT ' + aliceToken) 
        .expect(200)
        .should.eventually.have.property('body')
        .to.deep.equal([{
          uuid: IDS.alice.home,
          type: 'private',
          owner: IDS.alice.uuid,
          tag: 'home'
        }]))

    it("GET /drives bob should get both home and publicDrive1", async () => 
      request(app)
        .get('/drives')
        .set('Authorization', 'JWT ' + bobToken) 
        .expect(200)
        .should.eventually.have.property('body')
        .to.deep.equal([
          {
            uuid: IDS.bob.home,
            type: 'private',
            owner: IDS.bob.uuid,
            tag: 'home'
          },
          {
            uuid: IDS.publicDrive1.uuid,
            type: 'public',
            writelist: [IDS.bob.uuid],
            readlist: [],
            label: 'hello'
          }
        ]))

  })
})


