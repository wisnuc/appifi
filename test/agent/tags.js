const Promise = require('bluebird')
const path = require('path')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
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
  broadcast.emit('FruitmixStart', tmptest)
  await broadcast.until('FruitmixStarted')
}

describe(path.basename(__filename), () => {
  let token

  beforeEach(async () => {
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
  })

  it('should get [] for /tags', done => {
    request(app)
      .get('/tags')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body).to.deep.equal([])
        done()
      })
  })

  it('should create tag named test', done => {
    request(app)
      .post('/tags')
      .set('Authorization', 'JWT ' + token)
      .send({ name: 'test' })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body.name).to.deep.equal('test')
        expect(res.body.id).to.deep.equal(0)
        done()
      })
  })

  it('should return 400 to create tag name test if already has a tag named test', done => {
    request(app)
      .post('/tags')
      .set('Authorization', 'JWT ' + token)
      .send({ name: 'test' })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body.name).to.deep.equal('test')
        expect(res.body.id).to.deep.equal(0)
        request(app)
          .post('/tags')
          .set('Authorization', 'JWT ' + token)
          .send({ name: 'test' })
          .expect(400)
          .end((err, res) => done(err, res))
      })
  })

  describe('has a tag id 0, name test', () => {

    beforeEach(async () => {
      await new Promise((resolve, reject) => {
        request(app)
          .post('/tags')
          .set('Authorization', 'JWT ' + token)
          .send({ name: 'test' })
          .expect(200)
          .end(err => err ? reject(err) : resolve())
      })
    })

    it('should return 200 delete tag id 0', done => {
      request(app)
        .delete('/tags/0')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end(err => err ? done(err) : done())
    })

    it('tag id should be 1 , even if 0 has be deleted', done => {
      request(app)
        .delete('/tags/0')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end(err => {
          if (err) return done(err)
          request(app)
            .post('/tags')
            .set('Authorization', 'JWT ' + token)
            .send({ name: 'test' })
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.name).to.deep.equal('test')
              expect(res.body.id).to.deep.equal(1)
              done()
            })
        })
    })

    it('should return 200 if change tag name', done => {
      request(app)
        .patch('/tags/0')
        .set('Authorization', 'JWT ' + token)
        .send({ name: 'test2' })
        // .expect(200)
        .end((err, res) => {
          console.log(err)
          console.log(res.body)
          if (err) return done(err)
          expect(res.body.name).to.deep.equal('test2')
          expect(res.body.id).to.deep.equal(0)
          done()
        })
    })
  })
})