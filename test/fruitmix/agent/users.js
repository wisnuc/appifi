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

const User = require('src/fruitmix/user/user')
const Drive = require('src/fruitmix/drive/drive')
const File = require('src/fruitmix/file/file')

const IDS = {

  alice: {
    uuid:'9f93db43-02e6-4b26-8fae-7d6f51da12af',
    home: 'e2adb5d0-c3c7-4f2a-bd64-3320a1ed0dee',
  },

  bob: {
    uuid: 'a278930c-261b-4a9c-a296-f99ed00ac089',
    home: 'b7566c69-91f5-4299-b4f4-194df92b01a9',
  },

  charlie: {
    uuid: 'c12f1332-be48-488b-a3ae-d5f7636c42d6',
    home: '1da855c5-33a9-43b2-a93a-279c6c17ab58',
  },

  david: {
    uuid: '991da067-d75a-407d-a513-a5cf2191e72e',
    home: 'b33c3449-a5d4-4393-91c5-6453aeaf5f41',
  },

  emma: {
    uuid: 'fb82cf8f-cfbf-4721-a85e-990e3361a7dc',
    home: '37f4b93f-051a-4ece-8761-81ed617a28bd',
  },

  frank: {
    uuid: '50fac2de-84fe-488f-bd06-f1312aa03852',
    home: '0e040acf-198f-427d-a3a3-d28f9fc17564',
  },

  publicDrive1: {
    uuid: '01f7bcfd-8576-4dc5-b72f-65ad2acd82b2',
  }
}

/**
c84b352a-3af0-4742-8d4c-5f94d0e37aaa
19afe2c1-e4d5-4376-8f99-a935c0c43a4c
fdc4dca7-edf7-431b-bd22-16e78b4eae01
b08010d3-c5cf-4f26-9865-17868dfa264d
1a07d314-42b4-432e-8578-fd43cbf917bb
99d776e5-423f-4da6-b652-204a6de2f257
2cef59ee-765c-46d5-b5ce-6843372cc6d1
0c871c89-aaa8-412c-9b85-f63ec751c86f
e2ae3d04-c743-4711-b0b8-52aaf9faeffe
b327e5a1-04c6-4dac-bf3b-94a591be75d8
c1fbbf0e-42f3-428f-b52c-0f6e42e3b0b1
c3dec7c9-0dac-4de7-8684-265cc690ea8f
52f8436d-879b-4a7e-8846-99d1dab7e5db
011ece27-b0e8-4711-be31-a28c7c72a059
0ba6ac28-c246-4274-9d54-a6208f0a37ea
3d5069f5-e014-4402-b169-8bd38a4c8e18
f9725af2-5f6c-42b7-bb7c-5a9752d70f87
5e2874e8-1b3a-4bfc-9ba0-ac915f576141
47e20481-c931-4108-9450-42b90af3a7f3
d7c60d71-4b23-4be4-9850-5a3d9910bf6d
e0751e74-50e6-4146-94a4-6ae37aca0ad2
0d6acc61-93bd-4430-bb63-fb73b9b57226
2be66d58-7c4f-41e1-a9da-e80a8c4acc82
7ff76a40-6dc0-4073-ada9-ca6daeb78892
ed40387e-cb40-4d54-999d-e9a0701bf800
dc56af66-1e25-4029-9d6b-a77ee820ecf0
f77cb001-c986-4ca0-ab55-a0c153eaca75
ff48b35b-5308-42e6-9cb9-4b5ad02ee293
8056f3ae-0f0c-49f9-8844-98742530108b
e5ecd96d-4cd1-4205-a57e-c4aee74ec95c
912c6a02-6028-47cd-9dce-4a4434469f82
df05f7db-fb94-4362-8cd1-eadf06177490
07112b52-e127-493e-960d-49c1f1017a11
416c456d-b761-4807-adae-6023f9d8f061
9da656ae-18be-4e3b-a5c9-4bbeb888632c
220c27cc-ea36-4319-bd21-1ba229b23af6
3ae0973c-3c70-41be-8261-6405a7271c6d
ef4d117e-e47e-45c3-9a9d-e89fe2c03592

**/

const stubUserUUID = username => 
  sinon.stub(UUID, 'v4')
    .onFirstCall().returns(IDS[username].uuid)
    .onSecondCall().returns(IDS[username].home)
    .onThirdCall().throws(new Error('function called more than twice'))

const createUserAsync = async(username, token, isAdmin) => {

  let props = { username, password: username }
  if (isAdmin) props.isAdmin = true

  let req = request(app)
    .post('/users')
    .send(props)
    .expect(200)

  if (token) req.set('Authorization', 'JWT ' + token)

  stubUserUUID(username)
  try {
    let res = await req 
    let real = res.body.uuid 
    let expected = IDS[username].uuid
    if (real !== expected) throw new Error(`user uuid mismatch, real ${real}, expected ${expected}`)
    return res.body
  }
  finally {
    UUID.v4.restore()
  }
}

/**
Retrieve test user's token
*/
const retrieveTokenAsync = async username => 
  (await request(app)
    .get('/token')
    .auth(IDS[username].uuid, username)).body.token

const createPublicDriveAsync = async (props, token, uuid) => {

  if (!token || !uuid) throw new Error('token and uuid must be provided')

  let req = request(app)
    .post('/drives')
    .send(props)
    .set('Authorization', 'JWT ' + token)
    .expect(200)

  sinon.stub(UUID, 'v4').returns(uuid) 
  try {
    let res = await req
    if (res.body.uuid !== uuid) 
      throw new Error(`drive uuid mismatch, real ${res.body.uuid}, expected ${uuid}`)
    return res.body
  }
  finally {
    UUID.v4.restore()
  }
}

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')
const usersPath = path.join(tmptest, 'users.json')
const drivesPath = path.join(tmptest, 'drives.json')
const drivesDir = path.join(tmptest, 'drives')

/**
Reset directories and reinit User module
*/
const resetAsync = async() => {
  await rimrafAsync(tmptest) 
  await mkdirpAsync(tmpDir) 
  
  await User.initAsync(usersPath, tmpDir)
  await Drive.initAsync(drivesPath, tmpDir)
  await File.initAsync(drivesDir, tmpDir)
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


