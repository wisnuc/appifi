const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const Auth = require('src/middleware/Auth')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const USERS = require('./tmplib').USERS
const requestToken = require('./tmplib').requestToken
const initUsersAsync = require('./tmplib').initUsersAsync

describe(path.basename(__filename), () => {

  beforeEach(async () => {
    await initUsersAsync(fruitmixDir, [USERS.alice])
  })

  it('should get [] for /tags', done => {
    let fruitmix = new Fruitmix({ fruitmixDir })
    let app = new App({ fruitmix })
    fruitmix.once('FruitmixStarted', () => {
      requestToken(app.express, USERS.alice.uuid, 'alice', (err, token) => {
        if (err) return done(err)
        request(app.express)
          .get('/tags')
          .set('Authorization', 'JWT ' + token)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body).to.deep.equal([])
            done()
          })
      })
    })
  })

  it('should create tag named test', done => {
    let fruitmix = new Fruitmix({ fruitmixDir })
    let app = new App({ fruitmix })
    fruitmix.once('FruitmixStarted', () => {
      requestToken(app.express, USERS.alice.uuid, 'alice', (err, token) => {
        if (err) return done(err)
        request(app.express)
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
    })
  })

  it('should return 400 to create tag name test if already has a tag named test', done => {
    let fruitmix = new Fruitmix({ fruitmixDir })
    let app = new App({ fruitmix })
    fruitmix.once('FruitmixStarted', () => {
      requestToken(app.express, USERS.alice.uuid, 'alice', (err, token) => {
        if (err) return done(err)
        request(app.express)
          .post('/tags')
          .set('Authorization', 'JWT ' + token)
          .send({ name: 'test' })
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.name).to.deep.equal('test')
            expect(res.body.id).to.deep.equal(0)
            request(app.express)
              .post('/tags')
              .set('Authorization', 'JWT ' + token)
              .send({ name: 'test' })
              .expect(400)
              .end((err, res) => done(err, res))
          })
      })
    })
  })

  describe('has a tag id 0, name test', () => {

    beforeEach(async () => {
      let tags = {
        tags: [
          {
            name: "test",
            id: 0,
            color: null,
            group: null,
            creator: USERS.alice.uuid,
            ctime: 1524123527980,
            mtime: 1524123527980
          }
        ],
        index: 0
      }
      await fs.writeFileAsync(path.join(fruitmixDir, 'tags.json'), JSON.stringify(tags, null, '  '))
    })

    it('should return 200 delete tag id 0', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, USERS.alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .delete('/tags/0')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end(err => err ? done(err) : done())
        })
      })
    })

    it('tag id should be 1 , even if 0 has be deleted', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, USERS.alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .delete('/tags/0')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end(err => {
              if (err) return done(err)
              request(app.express)
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
      })
    })

    it('should return 200 if change tag name', done => {
      let fruitmix = new Fruitmix({ fruitmixDir })
      let app = new App({ fruitmix })
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app.express, USERS.alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          request(app.express)
            .patch('/tags/0')
            .set('Authorization', 'JWT ' + token)
            .send({ name: 'test2' })
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.name).to.deep.equal('test2')
              expect(res.body.id).to.deep.equal(0)
              done()
            })
        })
      })
    })
  })
})