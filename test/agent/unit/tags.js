const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const request = require('supertest')
const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const USERS = require('./tmplib').USERS
const requestTokenAsync = require('./tmplib').requestTokenAsync
const initUsersAsync = require('./tmplib').initUsersAsync

describe(path.basename(__filename), () => {
  let fruitmix, app, token

  // 初始化APP
  const initApp = done => {
    fruitmix = new Fruitmix({ fruitmixDir })
    app = new App({ fruitmix })
    fruitmix.on('FruitmixStarted', async () => {
      token = await requestTokenAsync(app.express, USERS.alice.uuid, 'alice')
      done()
    })
  }

  describe('base test', () => {
    beforeEach(done => {
      // 创建fruitmix 相关文件
      initUsersAsync(fruitmixDir, [USERS.alice]).then(() => {
        initApp(done)
      })
    })

    it('should get [] for /tags', done => {
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

    it('should create tag named test', done => {
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

    it('should return 400 to create tag name test if already has a tag named test', done => {
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

  describe('has a tag id 0, name test', () => {

    beforeEach((done) => {
      let tags = {
        tags: [
          {
            name: 'test',
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

      initUsersAsync(fruitmixDir, [USERS.alice]).then(async () => {
        await fs.writeFileAsync(path.join(fruitmixDir, 'tags.json'), JSON.stringify(tags, null, '  '))
        initApp(done)
      })
    })

    it('should return 200 delete tag id 0', done => {
      request(app.express)
        .delete('/tags/0')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end(err => err ? done(err) : done())
    })

    it('tag id should be 1 , even if 0 has be deleted', done => {
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

    it('should return 200 if change tag name', done => {
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
