const Promise = require('bluebird')
const path = require('path')
const request = require('supertest')
const superagent = require('superagent')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')

const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const app = require('src/app')
const { saveObjectAsync } = require('src/lib/utils')
const broadcast = require('src/common/broadcast')

const {
  IDS,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserGlobalAsync
} = require('./lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')

/**
Reset directories and reinit User module
*/
const resetAsync = async () => {

  broadcast.emit('FruitmixStop')
  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)
  broadcast.emit('FruitmixStart', tmptest) 
  await broadcast.until('FruitmixStarted')
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
          global: null,
          disabled: false 
        }))

  })

  describe('Alice only, retrieve token', () => {

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

    it('GET /token should return token with correct password, fbb09005', done => {
      request(app)
        .get('/token')
        .auth(IDS.alice.uuid, 'alice')
        .expect(200)
        .end(done)
    })
  })

  describe('Alice only, verify token', () => {

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

/**
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
**/

    // TODO move to other place
    it("TODO PATCH /users/:userUUID alice set global TODO", async () =>
      setUserGlobalAsync('alice')
        .should.eventually.have.deep.property('global')
        .that.equal(IDS.alice.global))
  })

  describe('Alice only', () => {

    let token
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
    })

    it('Get User List without token should return display users', done => {
      request(app)
        .get('/users')
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal([{
            uuid: IDS.alice.uuid,
            username: 'alice',
            avatar: null,
            disabled: false
          }])
          done()
        })
    })

    it('Get User List with token should return full users', done => {
      request(app)
        .get('/users')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal([{
            uuid: IDS.alice.uuid,
            username: 'alice',
            isFirstUser: true,
            isAdmin: true,
            avatar: null,
            global: null,
            disabled: false
          }])
          done()
        })
    }) 

    it('Create New User (bob), without token should fail 401', async () =>
      request(app)
        .post('/users')
        .send({ username: 'bob', password: 'bob', isAdmin: true })
        .expect(401))

    it('Create New User (bob), with token should succeed', done => {
      stubUserUUID('bob') 

      request(app)
        .post('/users')
        .set('Authorization', 'JWT ' + token)
        .send({ username: 'bob', password: 'bob', isAdmin: true })
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal({
            uuid: IDS.bob.uuid,
            username: 'bob',
            isFirstUser: false,
            isAdmin: true,
            avatar: null,
            disabled: false,
            global: null
          })

          UUID.v4.restore()
          done()
        })
    })

    it('Create New User david without token should fail 401', async () => 
      request(app)
        .post('/users')
        .send({ username: 'david', password: 'david', isAdmin: false })
        .expect(401))

    it('Create New User bob with token should succeed', done => {
      stubUserUUID('david') 

      request(app)
        .post('/users')
        .set('Authorization', 'JWT ' + token)
        .send({ username: 'david', password: 'david', isAdmin: false })
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal({
            uuid: IDS.david.uuid,
            username: 'david',
            isFirstUser: false,
            isAdmin: false,
            avatar: null,
            global: null,
            disabled: false
          })

          UUID.v4.restore()
          done()
        })
    })

    it('Get A User', done => {
      request(app)
        .get(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal({
            uuid: IDS.alice.uuid,
            username: 'alice',
            isFirstUser: true,
            isAdmin: true,
            avatar: null,
            global: null,
            disabled: false
          })
          done()
        })
    })


    it('Patch A User, change disabled to false should fail with 403', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ disabled: true })
        .expect(403)
        .end((err, res) => done(err))
    })

    it('Patch A User, with unexpected prop should fail with 400', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ hello: 'world' })
        .expect(400)
        .end((err, res) => done(err))
    }) 

    it('Patch A User, change username to hello should succeed', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ username: 'hello' })
        .expect(200)
        .end((err, res) => {

          expect(res.body).to.deep.equal({
            uuid: IDS.alice.uuid,
            username: 'hello',
            isFirstUser: true,
            isAdmin: true,
            avatar: null,
            global: null,
            disabled: false
          })

          done()
        })
    })

    it('Patch A User, change uuid should fail with 400', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ uuid: 'ba9d0f37-3b1e-486e-a84c-b5627e58a612' })
        .expect(400)
        .end((err, res) => done(err))
    }) 

    it('Patch A User, change password should fail with 403', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ password: 'world' })
        .expect(403)
        .end((err, res) => done(err))
    }) 

    it('Patch A User, change isFirstUser to false should fail with 400', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ isFirstUser: false })
        .expect(400)
        .end((err, res) => done(err))
    })

    it('Patch A User, change isAdmin to false should fail with 403', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ isAdmin: false })
        .expect(403)
        .end((err, res) => done(err))
    })

    it('Patch A User, change avatar to hello should fail with 400', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ avatar: 'hello' })
        .expect(400)
        .end((err, res) => done(err))
    })

    it('Patch A User, change global to hello should fail with 403', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .send({ global: 'hello' })
        .expect(403)
        .end((err, res) => done(err))
    })

    it('Update User Password, change password to hello should fail with token auth', done => { 
      request(app)
        .put(`/users/${IDS.alice.uuid}/password`)
        .set('Authorizatoin', 'JWT ' + token)
        .send({ password: 'hello' })
        .expect(401)
        .end((err, res) => done(err))
    })

    it('Update User Password, change password to hello should succeed with basic auth', done => {
      request(app)
        .put(`/users/${IDS.alice.uuid}/password`)
        .auth(IDS.alice.uuid, 'alice')
        .send({ password: 'hello' })
        .expect(200)
        .end((err, res) => done(err))
    })

    it('Update User Password, change password to hello and verify should succeed', done => {
      request(app)
        .put(`/users/${IDS.alice.uuid}/password`)
        .auth(IDS.alice.uuid, 'alice')
        .send({ password: 'hello' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          request(app)
            .get('/token')
            .auth(IDS.alice.uuid, 'hello')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              let newToken = res.body.token

              request(app)
                .get('/token/verify')
                .set('Authorization', 'JWT ' + newToken)
                .expect(200)
                .end(done)
            })
        })
    })

    it('Get Media Blacklist', done => {
      request(app)
        .get(`/users/${IDS.alice.uuid}/media-blacklist`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal([])
          done()
        })
    }) 

    it('Set Media Blacklist', done => {

      let fp1 = '6692ec11ce9d667312b73415b42bcece5e53885ab5b2fe0404aec2c8a210ed88'
      let fp2 = '9571ade89e5fc763a8847ede28b15f209f2e1f35168d283dae18992d0a645dc4'
      let fp3 = 'e73ecccb8ea2f0b5e366145ee22c8d7852981d3493bef8c5dbf2aeb24d78c585' 

      request(app)
        .put(`/users/${IDS.alice.uuid}/media-blacklist`)
        .set('Authorization', 'JWT ' + token)
        .send([fp1, fp2])
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          request(app)
            .get(`/users/${IDS.alice.uuid}/media-blacklist`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              expect(res.body).to.deep.equal([fp1, fp2])
              done()
            })
        })
    })

    it('Add Media Blacklist', done => {

      let fp1 = '6692ec11ce9d667312b73415b42bcece5e53885ab5b2fe0404aec2c8a210ed88'
      let fp2 = '9571ade89e5fc763a8847ede28b15f209f2e1f35168d283dae18992d0a645dc4'
      let fp3 = 'e73ecccb8ea2f0b5e366145ee22c8d7852981d3493bef8c5dbf2aeb24d78c585' 

      request(app)
        .put(`/users/${IDS.alice.uuid}/media-blacklist`)
        .set('Authorization', 'JWT ' + token)
        .send([fp1, fp2])
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          request(app)
            .post(`/users/${IDS.alice.uuid}/media-blacklist`)
            .set('Authorization', 'JWT ' + token)
            .send([fp2, fp3])
            .expect(200)
            .end((err, res) => {
              expect(res.body).to.deep.equal([fp1, fp2, fp3])
              done()
            })
        })
    })

    it('Subtract Media Blacklist', done => {

      let fp1 = '6692ec11ce9d667312b73415b42bcece5e53885ab5b2fe0404aec2c8a210ed88'
      let fp2 = '9571ade89e5fc763a8847ede28b15f209f2e1f35168d283dae18992d0a645dc4'
      let fp3 = 'e73ecccb8ea2f0b5e366145ee22c8d7852981d3493bef8c5dbf2aeb24d78c585' 

      request(app)
        .put(`/users/${IDS.alice.uuid}/media-blacklist`)
        .set('Authorization', 'JWT ' + token)
        .send([fp1, fp2, fp3])
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          request(app)
            .delete(`/users/${IDS.alice.uuid}/media-blacklist`)
            .set('Authorization', 'JWT ' + token)
            .send([fp1, fp3])
            .expect(200)
            .end((err, res) => {
              expect(res.body).to.deep.equal([fp2])
              done()
            })
        })
    })

    it('Get A Public Drive', done => {
      sinon.stub(UUID, 'v4').returns(IDS.publicDrive1.uuid)      
      request(app)
        .post('/drives')
        .send({ writelist: [IDS.alice.uuid], label: 'foobar' })
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          UUID.v4.restore()
          if (err) return done(err)

          request(app)
            .get(`/drives/${IDS.publicDrive1.uuid}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body).to.deep.equal({
                uuid: IDS.publicDrive1.uuid,
                type: 'public',
                writelist: [IDS.alice.uuid],
                readlist: [],
                label: 'foobar'
              })

              done()
            })
        })
    })

    it('Patch A Private Drive should fail with 403', done => {
      request(app)
        .patch(`/drives/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .expect(403)
        .end(done)
    })

    it('Delete Private Drive, should fail', done => {
      done(new Error('not implemented'))
    })

    it('Delete Public Drive, should success', done => {
      done(new Error('not implemented'))
    })
  }) 

  describe('WILD, After alice created bob TODO', () => {

    let aliceToken, bobToken
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice') 
      aliceToken = await retrieveTokenAsync('alice')
      await createUserAsync('bob', aliceToken, true)
      bobToken = await retrieveTokenAsync('bob')
    })

    it ("GET /drives should returns ONLY bob home with bob's token", async () => {
      return request(app)
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
      return request(app)
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

  describe('WILD, After alice created bob, TODO, alice creates public drive 1', () => {

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

  describe('WILD, After alice created bob and public drive 1', () => {

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

    it("GET /drives alice should get publicDrive1, alice is admin", async () => 
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
        },{
            label: "hello",
            readlist: [],
            type: "public",
            uuid: IDS.publicDrive1.uuid,
            writelist: [
                IDS.bob.uuid
            ]
          }
      ]))

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

  describe('After alice created bob , Test disabled', () => {
    
    let aliceToken, bobToken
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice') 
      aliceToken = await retrieveTokenAsync('alice')
      await createUserAsync('bob', aliceToken, true)
      bobToken = await retrieveTokenAsync('bob')
    })

    it('Patch Alice(superuser), change disabled to true should fail with 403', done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + aliceToken)
        .send({ disabled: true })
        .expect(403)
        .end((err, res) => done(err))
    })

    it('Patch Alice(superuser), change Bob(admin) disabled to true should success', done => {
      request(app)
        .patch(`/users/${IDS.bob.uuid}`)
        .set('Authorization', 'JWT ' + aliceToken)
        .send({ disabled: true })
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal({
            avatar: null,
            username: 'bob',
            uuid: IDS.bob.uuid,
            isAdmin: true,
            isFirstUser: false,
            global: null,
            disabled: true
          })
          done()
        })
    })

    it('Patch Alice, change Bob disabled(true) to false should success', done => {
      request(app)
        .patch(`/users/${IDS.bob.uuid}`)
        .set('Authorization', 'JWT ' + aliceToken)
        .send({ disabled: true })
        .expect(200)
        .end((err, res) => {
          //twice
          request(app)
          .patch(`/users/${IDS.bob.uuid}`)
          .set('Authorization', 'JWT ' + aliceToken)
          .send({ disabled: false })
          .expect(200)
          .end((err, res) => {
            expect(res.body).to.deep.equal({
              avatar: null,
              username: 'bob',
              uuid: IDS.bob.uuid,
              isAdmin: true,
              isFirstUser: false,
              global: null,
              disabled: false
            })
            done()
          })
        })
    })

    it('get 401 after alice change bob disabled to true', done => {
      request(app)
        .patch(`/users/${IDS.bob.uuid}`)
        .set('Authorization', 'JWT ' + aliceToken)
        .send({ disabled: true })
        .expect(200)
        .end((err, res) => {
          //twice
          request(app)
          .get(`/users`)
          .set('Authorization', 'JWT ' + bobToken)
          .send({ disabled: false })
          .expect(401)
          .end((err, res) => done(err))
        })
    })
  })
})
