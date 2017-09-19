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
          if (err) return done(err)
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
        .send({ username: 'alice', password: 'alice', avatar: 'www.baidu.com' })
        .expect(400)
        .end((err, res) => err ? done(err) : done())
    })

    it("create Alice is firstUser, disabled not allow", done => {
      request(app)
        .post('/users')
        .send({ username: 'alice', password: 'alice', disabled: true })
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
      charlieToken = await retrieveTokenAsync('charlie')
    })

    describe("FirstUser update itself", () => {
      it("Alice update self username, global should success", done => {
        request(app)
          .patch(`/users/${IDS.alice.uuid}`)
          .set('Authorization', 'JWT ' + aliceToken)
          .send({ username: 'ALICE', global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] } })
          .expect(200)
          .end((err, res) => {
            if (err) done(err)
            expect(res.body).to.be.deep.equal({
              uuid: IDS.alice.uuid,
              username: 'ALICE',
              isFirstUser: true,
              isAdmin: true,
              avatar: null,
              disabled: false,
              global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] }
            })
            done()
          })
      })

      it("Alice update self isAdmin, disabled should be failed", done => {
        request(app)
          .patch(`/users/${IDS.alice.uuid}`)
          .set('Authorization', 'JWT ' + aliceToken)
          .send({ isAdmin: false })
          .expect(403)
          .end((err, res) => {
            if (err) done(err)
            request(app)
              .patch(`/users/${IDS.alice.uuid}`)
              .set('Authorization', 'JWT ' + aliceToken)
              .send({ disabled: true })
              .expect(403)
              .end((err, res) => done(err))
          })
      })

      it("Alice update self uuid should get 400 ", done => {
        request(app)
          .patch(`/users/${IDS.alice.uuid}`)
          .set('Authorization', 'JWT ' + aliceToken)
          .send({ uuid: '50fac2de-84fe-488f-bd06-f1312aa03854' })
          .expect(400)
          .end((err, res) => done(err))
      })

      it("Alice update self isFirstUser should get 400 ", done => {
        request(app)
          .patch(`/users/${IDS.alice.uuid}`)
          .set('Authorization', 'JWT ' + aliceToken)
          .send({ isFirstUser: false })
          .expect(400)
          .end((err, res) => done(err))
      })
    })

    describe("Admin update itself", () => {
      it("Admin update self username, global should success", done => {
        request(app)
          .patch(`/users/${IDS.bob.uuid}`)
          .set('Authorization', 'JWT ' + bobToken)
          .send({ username: 'ALICE', global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] } })
          .expect(200)
          .end((err, res) => {
            if (err) done(err)
            expect(res.body).to.be.deep.equal({
              uuid: IDS.bob.uuid,
              username: 'ALICE',
              isFirstUser: false,
              isAdmin: true,
              avatar: null,
              disabled: false,
              global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] }
            })
            done()
          })
      })

      it("Admin update self isAdmin, disabled should get 403", done => {
        request(app)
          .patch(`/users/${IDS.bob.uuid}`)
          .set('Authorization', 'JWT ' + bobToken)
          .send({ isAdmin: false })
          .expect(403)
          .end((err, res) => {
            if (err) done(err)
            request(app)
              .patch(`/users/${IDS.bob.uuid}`)
              .set('Authorization', 'JWT ' + bobToken)
              .send({ disabled: true })
              .expect(403)
              .end((err, res) => done(err))
          })
      })

      it("Admin update self uuid should get 400 ", done => {
        request(app)
          .patch(`/users/${IDS.bob.uuid}`)
          .set('Authorization', 'JWT ' + bobToken)
          .send({ uuid: '50fac2de-84fe-488f-bd06-f1312aa03854' })
          .expect(400)
          .end((err, res) => done(err))
      })

      it("Admin update self isFirstUser should get 400 ", done => {
        request(app)
          .patch(`/users/${IDS.bob.uuid}`)
          .set('Authorization', 'JWT ' + bobToken)
          .send({ isFirstUser: false })
          .expect(400)
          .end((err, res) => done(err))
      })
    })

    describe("Common user update itself", () => {
      it("Common user update self username, global should success", done => {
        request(app)
          .patch(`/users/${IDS.charlie.uuid}`)
          .set('Authorization', 'JWT ' + charlieToken)
          .send({ username: 'ALICE', global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] } })
          .expect(200)
          .end((err, res) => {
            if (err) done(err)
            expect(res.body).to.be.deep.equal({
              uuid: IDS.charlie.uuid,
              username: 'ALICE',
              isFirstUser: false,
              isAdmin: false,
              avatar: null,
              disabled: false,
              global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] }
            })
            done()
          })
      })

      it("Common user update self isAdmin, disabled should get 403", done => {
        request(app)
          .patch(`/users/${IDS.charlie.uuid}`)
          .set('Authorization', 'JWT ' + charlieToken)
          .send({ isAdmin: false })
          .expect(403)
          .end((err, res) => {
            if (err) done(err)
            request(app)
              .patch(`/users/${IDS.charlie.uuid}`)
              .set('Authorization', 'JWT ' + charlieToken)
              .send({ disabled: true })
              .expect(403)
              .end((err, res) => done(err))
          })
      })

      it("Common user update self uuid should get 400 ", done => {
        request(app)
          .patch(`/users/${IDS.charlie.uuid}`)
          .set('Authorization', 'JWT ' + charlieToken)
          .send({ uuid: '50fac2de-84fe-488f-bd06-f1312aa03854' })
          .expect(400)
          .end((err, res) => done(err))
      })

      it("Common user update self isFirstUser should get 400 ", done => {
        request(app)
          .patch(`/users/${IDS.charlie.uuid}`)
          .set('Authorization', 'JWT ' + charlieToken)
          .send({ isFirstUser: false })
          .expect(400)
          .end((err, res) => done(err))
      })
    })

    it("Alice update bob 'username', 'isAdmin', 'global', 'disabled' should success ", done => {
      request(app)
        .patch(`/users/${IDS.bob.uuid}`)
        .set('Authorization', 'JWT ' + aliceToken)
        .send({ disabled: true, username: 'BOB', isAdmin: false, global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] } })
        .expect(200)
        .end((err, res) => {
          if (err) done(err)
          expect(res.body).to.be.deep.equal({
            uuid: IDS.bob.uuid,
            username: 'BOB',
            isFirstUser: false,
            isAdmin: false,
            avatar: null,
            disabled: true,
            global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] }
          })
          done()
        })
    })

    it("Alice update bob uuid should get 400 ", done => {
      request(app)
        .patch(`/users/${IDS.bob.uuid}`)
        .set('Authorization', 'JWT ' + aliceToken)
        .send({ uuid: '50fac2de-84fe-488f-bd06-f1312aa03854' })
        .expect(400)
        .end((err, res) => done(err))
    })

    it("Alice update bob isFirstUser should get 400", done => {
      request(app)
        .patch(`/users/${IDS.bob.uuid}`)
        .set('Authorization', 'JWT ' + aliceToken)
        .send({ isFirstUser: true })
        .expect(400)
        .end((err, res) => done(err))
    })

    it("Bob update charlie 'username', 'global', 'disabled' should success ", done => {
      request(app)
        .patch(`/users/${IDS.charlie.uuid}`)
        .set('Authorization', 'JWT ' + bobToken)
        .send({ disabled: true, username: 'CHARLIE', global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] } })
        .expect(200)
        .end((err, res) => {
          if (err) done(err)
          expect(res.body).to.be.deep.equal({
            uuid: IDS.charlie.uuid,
            username: 'CHARLIE',
            isFirstUser: false,
            isAdmin: false,
            avatar: null,
            disabled: true,
            global: { id: '50fac2de-84fe-488f-bd06-f1312aa03854', wx: [] }
          })
          done()
        })
    })

    it("Bob update charlie 'isAdmin' should get 403", done => {
      request(app)
        .patch(`/users/${IDS.charlie.uuid}`)
        .set('Authorization', 'JWT ' + bobToken)
        .send({ isAdmin: true })
        .expect(403)
        .end((err, res) => done(err))
    })

    it("Alice update charlie 'isAdmin' should get 200", done => {
      request(app)
        .patch(`/users/${IDS.charlie.uuid}`)
        .set('Authorization', 'JWT ' + aliceToken)
        .send({ isAdmin: true })
        .expect(200)
        .end((err, res) => done(err))
    })

    it("charlie update Alice username should get 400", done => {
      request(app)
        .patch(`/users/${IDS.alice.uuid}`)
        .set('Authorization', 'JWT ' + charlieToken)
        .send({ username: 'AliCE' })
        .expect(400)
        .end((err, res) => done(err))
    })

    it("charlie update Bob username should get 400", done => {
      request(app)
        .patch(`/users/${IDS.bob.uuid}`)
        .set('Authorization', 'JWT ' + charlieToken)
        .send({ username: 'BBB' })
        .expect(400)
        .end((err, res) => done(err))
    })

    describe("Alice super user, bob and david admin, charlie and emma common user", () => {
      let davidToken, emmaToken
      beforeEach(async () => {
        await createUserAsync('david', aliceToken, true)
        davidToken = await retrieveTokenAsync('david')
        // bob create
        await createUserAsync('emma', bobToken, false)
        emmaToken = await retrieveTokenAsync('emma')
      })

      it("bob change david username should failed 400", done => {
        request(app)
          .patch(`/users/${IDS.david.uuid}`)
          .set('Authorization', 'JWT ' + bobToken)
          .send({ username: 'DDDDDD' })
          .expect(400)
          .end((err, res) => done(err))
      })

      it("bob change david disabled should failed 400", done => {
        request(app)
          .patch(`/users/${IDS.david.uuid}`)
          .set('Authorization', 'JWT ' + bobToken)
          .send({ disabled: true })
          .expect(400)
          .end((err, res) => done(err))
      })

      it("charlie change emma disabled should failed 400", done => {
        request(app)
          .patch(`/users/${IDS.emma.uuid}`)
          .set('Authorization', 'JWT ' + charlieToken)
          .send({ disabled: true })
          .expect(400)
          .end((err, res) => done(err))
      })

      it("charlie change itself disabled should failed 403", done => {
        request(app)
          .patch(`/users/${IDS.charlie.uuid}`)
          .set('Authorization', 'JWT ' + charlieToken)
          .send({ disabled: true })
          .expect(403)
          .end((err, res) => done(err))
      })
    })
  })
})