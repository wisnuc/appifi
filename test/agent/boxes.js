const path = require('path')
const request = require('supertest')
const superagent = require('superagent')
const Promise = require('bluebird')
const fs = require('fs')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const app = require('src/app')
const { saveObjectAsync } = require('src/lib/utils')
const broadcast = require('src/common/broadcast')

const User = require('src/models/user')
const boxData = require('src/box/boxData')

const {
  IDS,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserGlobalAsync,
  laCloudTokenAsync,
  waCloudTokenAsync,
  createBoxAsync,
  createBranchAsync,
  forgeRecords
} = require('./lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')
const repoDir = path.join(tmptest, 'repo')

/**
Reset directories and reinit User module
*/
const resetAsync = async() => {

  broadcast.emit('FruitmixStop')

  await broadcast.until('UserDeinitDone', 'BoxDeinitDone')

  await rimrafAsync(tmptest) 
  await mkdirpAsync(tmpDir) 
  await mkdirpAsync(repoDir)
 
  broadcast.emit('FruitmixStart', tmptest) 

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

  describe('Alice, with token and global', () => {

    let token
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserGlobalAsync('alice')
      token = await retrieveTokenAsync('alice')
    })

    it("GET /cloudToken", done => {
      request(app)
        .get('/cloudToken')
        .query({global: IDS.alice.global})
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.token).to.be.an('string')
          done() 
        })
    })

    it("POST /cloudToken/decode", done => {
      request(app)
        .get('/cloudToken')
        .query({ global: IDS.alice.global })
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let token = res.body.token
          request(app)
            .post('/cloudToken/decode')
            .set('Authorization', 'JWT ' + token)
            .send({ token })
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.global).to.equal(IDS.alice.global)
              done()
            })
        })
    })
  })

  describe('Alice, with token, global, and cloudToken', () => {
    let token, cloudToken, boxUUID = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserGlobalAsync('alice')
      token = await retrieveTokenAsync('alice')
      cloudToken = await laCloudTokenAsync('alice')
      sinon.stub(UUID, 'v4').returns(boxUUID)
    })

    afterEach(() => UUID.v4.restore())

    it("GET /boxes should return []", done => {
      request(app)
        .get('/boxes')
        .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
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
        .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.uuid).to.deep.equal(boxUUID)
          expect(res.body.name).to.deep.equal('hello')
          expect(res.body.owner).to.deep.equal(IDS.alice.global)
          expect(res.body.users).to.deep.equal([])
          done()
        })
    })
  })

  describe('Alice create box, Bob in users list', () => {
    let aliceToken, aliceCloudToken, bobToken, bobCloudToken, doc
    let boxUUID = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserGlobalAsync('alice')
      aliceToken = await retrieveTokenAsync('alice')
      aliceCloudToken = await laCloudTokenAsync('alice')

      sinon.stub(UUID, 'v4').returns(boxUUID)
      let props = {name: 'hello', users: [IDS.bob.global]}
      doc = await createBoxAsync(props, 'alice')

      bobCloudToken = await waCloudTokenAsync('bob')
    })

    afterEach(() => UUID.v4.restore())

    it("GET /cloudToken get bob cloudToken", done => {
      request(app)
        .get('/cloudToken')
        .query({ global: IDS.bob.global})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.token).to.be.an('string')
          done()
        })
    })

    it("GET /boxes bob should get box", done => {
      request(app)
        .get('/boxes')
        .set('Authorization', 'JWT ' + bobCloudToken)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([doc])
          done()
        })
    })

    it("GET /boxes/{uuid} bob should get appointed box", done => {
      request(app)
        .get(`/boxes/${boxUUID}`)
        .set('Authorization', 'JWT ' + bobCloudToken)
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          expect(res.body).to.deep.equal(doc)
          done()
        })
    })

    it("PATCH /boxes/{uuid} alice update the box successfully", done => {
      let props = {
        name: 'world',
        users: {op: 'add', value: [IDS.charlie.global]}
      }

      request(app)
        .patch(`/boxes/${boxUUID}`)
        .send(props)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          expect(res.body.uuid).to.deep.equal(boxUUID)
          expect(res.body.name).to.deep.equal('world')
          expect(res.body.owner).to.deep.equal(IDS.alice.global)
          expect(res.body.users).to.deep.equal([IDS.bob.global, IDS.charlie.global])
          done()
        })
    })

    it("PATCH /boxes/{uuid} bob could not update the box created by alice", done => {
      let props = {name: 'world'} //[{path: 'name', operation: 'update', value: 'world'}]
      request(app)
        .patch(`/boxes/${boxUUID}`)
        .send(props)
        .set('Authorization', 'JWT ' + bobCloudToken) //+ ' ' + bobToken)
        .expect(403)
        .end(done)
    })

    it('DELETE /boxes/{uuid} alice delete box successfully', done => {
      request(app)
        .delete(`/boxes/${boxUUID}`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end(done)
    })

    it('DELETE /boxes/{uuid} bob can not delete box', done => {
      request(app)
        .delete(`/boxes/${boxUUID}`)
        .set('Authorization', 'JWT ' + bobCloudToken)// + ' ' + bobToken)
        .expect(403)
        .end(done)
    })
  })

  describe('after box is created', () => {
    let aliceToken, aliceCloudToken, bobToken, bobCloudToken, doc
    let boxUUID = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'
    let uuid_1 = 'ff5d42b9-4b8f-452d-a102-ebfde5cdf948'
    let uuid_2 = 'a474d150-a7d4-47f2-8338-3733fa4b8783'
    let uuid_3 = '30ee1474-571c-42c1-be1e-0f714d0d4968'
    let commit_1 = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7'
    let commit_2 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserGlobalAsync('alice')
      aliceToken = await retrieveTokenAsync('alice')
      aliceCloudToken = await laCloudTokenAsync('alice')

      sinon.stub(UUID, 'v4').onCall(0).returns(boxUUID)
                            .onCall(1).returns(uuid_1)
                            .onCall(2).returns(uuid_2)
                            .onCall(3).returns(uuid_3)
                          
      let props = {name: 'hello', users: [IDS.bob.global]}
      doc = await createBoxAsync(props, 'alice')
      bobCloudToken = await waCloudTokenAsync('bob')
    })

    afterEach(() => UUID.v4.restore())

    it('POST /boxes/{uuid}/tweets alice should add a tweet into tweetsDB', done => {
      request(app)
        .post(`/boxes/${boxUUID}/tweets`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .send({comment: 'hello'})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.uuid).to.equal(uuid_1)
          expect(res.body.tweeter).to.equal(IDS.alice.global)
          expect(res.body.comment).to.equal('hello')
          done()
        })
    })

    it('POST /boxes/{uuid}/tweets alice should upload a blob', done => {
      let sha256 = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
      let obj = {
        comment: 'hello',
        type: 'blob',
        size: 2331588,
        sha256
      }
      request(app)
        .post(`/boxes/${boxUUID}/tweets`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .field('blob', JSON.stringify(obj))
        .attach('file', 'testpic/20141213.jpg')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.uuid).to.equal(uuid_2)
          expect(res.body.tweeter).to.equal(IDS.alice.global)
          expect(res.body.comment).to.equal('hello')
          expect(res.body.type).to.equal('blob')
          expect(res.body.id).to.equal(sha256)
          done()
        })
    })

    it('POST /boxes/{uuid}/tweets alice should upload a list', done => {
      let sha256_1 = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
      let sha256_2 = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7'
      let obj = {
        comment: 'hello',
        type: 'list',
        list: [{size: 2331588, sha256: sha256_1, filename: 'pic1', id: uuid_2},
               {size: 5366855, sha256: sha256_2, filename: 'pic2', id: uuid_3}]
      }
      request(app)
        .post(`/boxes/${boxUUID}/tweets`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .field('list', JSON.stringify(obj))
        .attach('pic1', 'testpic/20141213.jpg', JSON.stringify({id: uuid_2}))
        .attach('pic2', 'testpic/20160719.jpg', JSON.stringify({id: uuid_3}))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          // consume uuid.v4: create box, upload two file(tpm path, twice)
          expect(res.body.uuid).to.equal(uuid_3)
          expect(res.body.tweeter).to.equal(IDS.alice.global)
          expect(res.body.comment).to.equal('hello')
          expect(res.body.type).to.equal('list')
          done()
        })
    })

    it('POST /boxes/{uuid}/tweets should cover the last record if it is incorrect', done => {
      let text = '{"comment":"hello","ctime":1500343057045,"index":4,"tweeter":"ocMvos6NjeKLIBqg5Mr9QjxrP1FA"'
      let filepath = path.join(tmptest, 'boxes', boxUUID, 'records')
      fs.writeFileSync(filepath, text)

      request(app)
        .post(`/boxes/${boxUUID}/tweets`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .send({comment: 'hello'})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          request(app)
            .get(`/boxes/${boxUUID}/tweets`)
            .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.length).to.equal(1)
              expect(res.body[0].comment).to.equal('hello')
              expect(res.body[0].index).to.equal(0)
              done()
            })
        })
    })

    it('GET /boxes/{uuid}/tweets should get all records', done => {
      forgeRecords(boxUUID, 'alice')
        .then(() => {
          request(app)
            .get(`/boxes/${boxUUID}/tweets`)
            .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
            .expect(200)
            .end((err, res) => {
              expect(res.body.length).to.equal(10)
              done()
            })
        })
        .catch(done)
    })

    it('GET /boxes/{uuid}/tweets should repair tweets DB if the last record is incorrect', done => {
      forgeRecords(boxUUID, 'alice')
        .then(() => {
          let filepath = path.join(tmptest, 'boxes', boxUUID, 'records')
          let size = fs.readFileSync(filepath).length
          let text = '{"comment":"hello","ctime":1500343057045,"index":10,"tweeter":"ocMvos6NjeKLIBqg5Mr9QjxrP1FA"'
          
          let writeStream = fs.createWriteStream(filepath, { flags: 'r+', start: size })
          writeStream.write(`\n${text}`)
          writeStream.close()

          request(app)
            .get(`/boxes/${boxUUID}/tweets`)
            .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
            .expect(200)
            .end((err, res) => {
              expect(res.body.length).to.equal(10)
              done()
            })
        })
        .catch(done)
    })

    it('GET /boxes/{uuid}/tweets tweets in blackList should be removed', done => {
      forgeRecords(boxUUID, 'alice')
        .then(() => {
          request(app)
            .delete(`/boxes/${boxUUID}/tweets`)
            .send({indexArr: [2]})
            .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
            .expect(200)
            .end(err => {
              if (err) return done(err)

              request(app)
                .get(`/boxes/${boxUUID}/tweets`)
                .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)
                  let arr = res.body.map(r => r.index)
                  expect(res.body.length).to.equal(9)
                  expect(arr.includes(2)).to.be.false
                  done()
                })
            })
        })
        .catch(done)
    })

    it('DELETE /boxes/{uuid}/tweets should delete appointed tweets', done => {
      request(app)
        .delete(`/boxes/${boxUUID}/tweets`)
        .send({indexArr: [2,4]})
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end(err => {
          if (err) return done(err)
          let fpath = path.join(tmptest, 'boxes', boxUUID, 'blackList')
          let result = fs.readFileSync(fpath).toString()
          expect(result).to.equal('2,4')
          done()
        })
    })

    it('POST /boxes/{uuid}/branches alice create a new branch successfully', done => {
      request(app)
        .post(`/boxes/${boxUUID}/branches`)
        .send({ name: 'branch_1', head: commit_1 })
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          expect(res.body).to.deep.equal({
            uuid: uuid_1,
            name: 'branch_1',
            head: commit_1
          })
          done()
        })
    })

    it('POST /boxes/{uuid}/branches bob create a new branch successfully', done => {
      request(app)
        .post(`/boxes/${boxUUID}/branches`)
        .send({ name: 'branch_2', head: commit_2 })
        .set('Authorization', 'JWT ' + bobCloudToken)
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          expect(res.body).to.deep.equal({
            uuid: uuid_1,
            name: 'branch_2',
            head: commit_2
          })
          done()
        })
    })

    it('GET /boxes/{uuid}/branches alice should get all branches', done => {
      request(app)
        .post(`/boxes/${boxUUID}/branches`)
        .send({ name: 'branch_1', head: commit_1 })
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)

          let result = res.body
          request(app)
            .get(`/boxes/${boxUUID}/branches`)
            .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
            .expect(200)
            .end((err, res) => {
              if(err) return done(err)
              expect(res.body).to.deep.equal([result])
              done()
            })
        })
    })
  })

  describe('after branch is created', () => {
    let aliceToken, aliceCloudToken, doc, branch
    let boxUUID = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'
    let uuid = 'ff5d42b9-4b8f-452d-a102-ebfde5cdf948'
    let commit_1 = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7'
    let commit_2 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserGlobalAsync('alice')
      aliceToken = await retrieveTokenAsync('alice')
      aliceCloudToken = await laCloudTokenAsync('alice')

      sinon.stub(UUID, 'v4').onFirstCall().returns(boxUUID)
                            .onSecondCall().returns(uuid)

      let props = {name: 'hello', users: [IDS.bob.global]}
      doc = await createBoxAsync(props, 'alice')
      let props_1 = {name: 'testBranch', head: commit_1}
      branch = await createBranchAsync(props_1, boxUUID, 'alice')
    })

    afterEach(() => UUID.v4.restore())

    it('GET /boxes/{uuid}/branches/{branchUUID} should return appointed branch', done => {
      request(app)
        .get(`/boxes/${boxUUID}/branches/${uuid}`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          expect(res.body).to.deep.equal(branch)
          done()
        })
    })

    it('GET /boxes/{uuid}/branches/{branchUUID} should return 404 if branch not exist', done => {
      let branchUUID = 'a474d150-a7d4-47f2-8338-3733fa4b8783'
      request(app)
        .get(`/boxes/${boxUUID}/branches/${branchUUID}`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(404)
        .end(done)
    })

    it('PATCH /boxes/{uuid}/branches/{branchUUID} should update a branch name', done => {
      request(app)
        .patch(`/boxes/${boxUUID}/branches/${uuid}`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .send({ name: 'newName'})
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          expect(res.body).to.deep.equal({
            uuid: uuid,
            name: 'newName',
            head: commit_1
          })
          done()
        })
    })

    it('PATCH /boxes/{uuid}/branches/{branchUUID} should return 404 if commit not found', done => {
      request(app)
        .patch(`/boxes/${boxUUID}/branches/${uuid}`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .send({ name: 'newName', head: commit_2})
        .expect(404)
        .end(done)
    })

    it('DELETE /boxes/{uuid}/branches/{branchUUID} should delete appointed branch', done => {
      request(app)
        .delete(`/boxes/${boxUUID}/branches/${uuid}`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end(done)
    })   
  })




})
