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
const { saveObjectAsync } = require('src/fruitmix/lib/utils')
const broadcast = require('src/common/broadcast')

const User = require('src/fruitmix/models/user')
const BoxData = require('src/fruitmix/box/box')

const {
  IDS,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserGlobalAsync,
  retrieveCloudTokenAsync,
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
      cloudToken = await retrieveCloudTokenAsync('alice')
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
          expect(res.body.doc).to.deep.equal({
            uuid: boxUUID,
            name: 'hello',
            owner: IDS.alice.global,
            users: []
          }) 
          done()
        })
    })
  })

  describe('Alice create box, Bob in users list', () => {
    let aliceToken, aliceCloudToken, bobToken, bobCloudToken, box
    let boxUUID = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserGlobalAsync('alice')
      aliceToken = await retrieveTokenAsync('alice')
      aliceCloudToken = await retrieveCloudTokenAsync('alice')

      await createUserAsync('bob', aliceToken, true)
      await setUserGlobalAsync('bob')
      bobToken = await retrieveTokenAsync('bob')
      bobCloudToken = await retrieveCloudTokenAsync('bob')

      sinon.stub(UUID, 'v4').returns(boxUUID)

      let props = {name: 'hello', users: [IDS.bob.global]}
      box = await createBoxAsync(props, 'alice')
    })

    afterEach(() => UUID.v4.restore())

    it("GET /boxes bob should get box", done => {
      request(app)
        .get('/boxes')
        .set('Authorization', 'JWT ' + bobCloudToken)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([box])
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
          expect(res.body).to.deep.equal(box)
          done()
        })
    })

    it("PATCH /boxes/{uuid} alice update the box successfully", done => {
      let props = [
                   {path: 'name', operation: 'update', value: 'world'},
                   {path: 'users', operation: 'add', value: [IDS.charlie.global]}
                  ]
      request(app)
        .patch(`/boxes/${boxUUID}`)
        .send(props)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          expect(res.body.doc).to.deep.equal({
            uuid: boxUUID,
            name: 'world',
            owner: IDS.alice.global,
            users: [IDS.bob.global, IDS.charlie.global]
          })
          done()
        })
    })

    it("PATCH /boxes/{uuid} bob could not update the box created by alice", done => {
      let props = [{path: 'name', operation: 'update', value: 'world'}]
      request(app)
        .patch(`/boxes/${boxUUID}`)
        .send(props)
        .set('Authorization', 'JWT ' + bobCloudToken + ' ' + bobToken)
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
        .set('Authorization', 'JWT ' + bobCloudToken + ' ' + bobToken)
        .expect(403)
        .end(done)
    })
  })

  describe('after box is created', () => {
    let aliceToken, aliceCloudToken, bobToken, bobCloudToken, box
    let boxUUID = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'
    let uuid_1 = 'ff5d42b9-4b8f-452d-a102-ebfde5cdf948'
    let uuid_2 = 'a474d150-a7d4-47f2-8338-3733fa4b8783'
    let commit_1 = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7'
    let commit_2 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserGlobalAsync('alice')
      aliceToken = await retrieveTokenAsync('alice')
      aliceCloudToken = await retrieveCloudTokenAsync('alice')

      await createUserAsync('bob', aliceToken, true)
      await setUserGlobalAsync('bob')
      bobToken = await retrieveTokenAsync('bob')
      bobCloudToken = await retrieveCloudTokenAsync('bob')

      sinon.stub(UUID, 'v4').onFirstCall().returns(boxUUID)
                            .onSecondCall().returns(uuid_1)
                            .onThirdCall().returns(uuid_2)
                          
      let props = {name: 'hello', users: [IDS.bob.global]}
      box = await createBoxAsync(props, 'alice')
    })

    afterEach(() => UUID.v4.restore())

    it('POST /boxes/{uuid}/twits alice should add a twit into twitsDB', done => {
      request(app)
        .post(`/boxes/${boxUUID}/twits`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .send({comment: 'hello'})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.uuid).to.equal(uuid_1)
          expect(res.body.twitter).to.equal(IDS.alice.global)
          expect(res.body.comment).to.equal('hello')
          done()
        })
    })

    it('POST /boxes/{uuid}/twits alice should upload a blob', done => {
      let sha256 = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'

      request(app)
        .post(`/boxes/${boxUUID}/twits`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .field('comment', 'hello')
        .field('type', 'blob')
        .field('size', 2331588)
        .field('sha256', sha256)
        .attach('file', 'testpic/20141213.jpg')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.uuid).to.equal(uuid_2)
          expect(res.body.twitter).to.equal(IDS.alice.global)
          expect(res.body.comment).to.equal('hello')
          expect(res.body.type).to.equal('blob')
          expect(res.body.sha256).to.equal(sha256)
          done()
        })
    })

    it('POST /boxes/{uuid}/twits should cover the last record if it is incorrect', done => {
      let text = '{"comment":"hello","ctime":1500343057045,"index":4,"twitter":"ocMvos6NjeKLIBqg5Mr9QjxrP1FA"'
      let filepath = path.join(tmptest, 'boxes', boxUUID, 'records')
      fs.writeFileSync(filepath, text)

      request(app)
        .post(`/boxes/${boxUUID}/twits`)
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .send({comment: 'hello'})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          request(app)
            .get(`/boxes/${boxUUID}/twits`)
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

    it('GET /boxes/{uuid}/twits should get all records', done => {
      forgeRecords(boxUUID, 'alice')
        .then(() => {
          request(app)
            .get(`/boxes/${boxUUID}/twits`)
            .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
            .expect(200)
            .end((err, res) => {
              expect(res.body.length).to.equal(10)
              done()
            })
        })
        .catch(done)
    })

    it('GET /boxes/{uuid}/twits should repair twits DB if the last record is incorrect', done => {
      forgeRecords(boxUUID, 'alice')
        .then(() => {
          let filepath = path.join(tmptest, 'boxes', boxUUID, 'records')
          let size = fs.readFileSync(filepath).length
          let text = '{"comment":"hello","ctime":1500343057045,"index":10,"twitter":"ocMvos6NjeKLIBqg5Mr9QjxrP1FA"'
          
          let writeStream = fs.createWriteStream(filepath, { flags: 'r+', start: size })
          writeStream.write(`\n${text}`)
          writeStream.close()

          request(app)
            .get(`/boxes/${boxUUID}/twits`)
            .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
            .expect(200)
            .end((err, res) => {
              expect(res.body.length).to.equal(10)
              done()
            })
        })
        .catch(done)
    })

    it('DELETE /boxes/{uuid}/twits should delete a twit', done => {
      request(app)
        .delete(`/boxes/${boxUUID}/twits`)
        .send({index: 2})
        .set('Authorization', 'JWT ' + aliceCloudToken + ' ' + aliceToken)
        .expect(200)
        .end(err => {
          if (err) return done(err)
          let fpath = path.join(tmptest, 'boxes', boxUUID, 'blackList')
          let result = fs.readFileSync(fpath).toString()
          expect(result).to.equal('2')
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
        .set('Authorization', 'JWT ' + bobCloudToken + ' ' + bobToken)
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
    let aliceToken, aliceCloudToken, box, branch
    let boxUUID = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'
    let uuid = 'ff5d42b9-4b8f-452d-a102-ebfde5cdf948'
    let commit_1 = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7'
    let commit_2 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      await setUserGlobalAsync('alice')
      aliceToken = await retrieveTokenAsync('alice')
      aliceCloudToken = await retrieveCloudTokenAsync('alice')

      sinon.stub(UUID, 'v4').onFirstCall().returns(boxUUID)
                            .onSecondCall().returns(uuid)

      let props = {name: 'hello', users: [IDS.bob.global]}
      box = await createBoxAsync(props, 'alice')
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
