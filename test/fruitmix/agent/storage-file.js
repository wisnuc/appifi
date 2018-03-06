const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
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

require('test/before')

const data = require('test/data/storage')
const router = require('src/routes/storage')

const app = require('src/app')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')

describe(path.basename(__filename), () => {

  describe('Fake storage', () => {

    it('Demo fake', done => {
      router.storage = data
      request(app)
        .get('/storage')
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal(data)
          done()
        })
    }) 
  })

  describe('Fake sde1 mountpoint, empty root', () => {

    let sde1 = Object.assign({}, data.blocks.find(blk => blk.name === 'sde1'), { mountpoint: tmptest })
    let blocks = [...data.blocks.filter(blk => blk.name !== 'sde1'), sde1]
    let fake = Object.assign({}, data, { blocks })

    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
      router.storage = fake 
    })

    it('Demo fake', done => {

      request(app)
        .get('/storage')
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.blocks.find(blk => blk.name === 'sde1').mountpoint).to.equal(tmptest)
          done()
        })
    })

    it('list empty root', done => {

      request(app)
        .get('/storage/blocks/sde1')
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })

    it('create hello dir in empty root', done => {

      request(app)
        .post('/storage/blocks/sde1')
        .send({ dirname: 'hello' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'hello'), (err, stat) => {
            if (err) return done(err)
            expect(state.isDirectory()).to.be.true
            expect(res.body).to.deep.equal({
              name: 'hello',
              type: 'directory',
              size: stat.size,
              ctime: stat.ctime.getTime()
            })
          })
          done()
        })
    })

    it('upload a file in empty root', done => {

      request(app)
        .post('/storage/blocks/sde1')
        .attach('file', 'testdata/alonzo_church.jpg')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'alonzo_church.jpg'), (err, stat) => {
            if (err) return done(err)
            expect(stat.isFile()).to.be.true
            expect(res.body).to.deep.equal({
              name: 'alonzo_church.jpg',
              type: 'file',
              size: stat.size,
              ctime: stat.ctime.getTime()
            })
            done()
          })
        })
    })

    it('upload an empty file in empty root', done => {

      request(app)
        .post('/storage/blocks/sde1')
        .attach('file', 'testdata/empty')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'empty'), (err, stat) => {
            if (err) return done(err)
            expect(stat.isFile()).to.be.true
            expect(res.body).to.deep.equal({
              name: 'empty',
              type: 'file',
              size: stat.size,
              ctime: stat.ctime.getTime()
            })
            done()
          })
        })
    })
  })

  describe('Fake sde1 mountpoint, with hello dir and world file', () => {

    let sde1 = Object.assign({}, data.blocks.find(blk => blk.name === 'sde1'), { mountpoint: tmptest })
    let blocks = [...data.blocks.filter(blk => blk.name !== 'sde1'), sde1]
    let fake = Object.assign({}, data, { blocks })
    let helloStat, worldStat

    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(path.join(tmptest, 'hello'))
      await fs.closeAsync(await fs.openAsync(path.join(tmptest, 'world'), 'w'))
      helloStat = await fs.lstatAsync(path.join(tmptest, 'hello'))
      worldStat = await fs.lstatAsync(path.join(tmptest, 'world'))
      router.storage = fake 
    })

    it('list root w/ hello world', done => {

      request(app)
        .get('/storage/blocks/sde1')
        .end((err, res) => {
          if (err) return done(err)
          let list = res.body.sort((a, b) => a.name.localeCompare(b.name))
          expect(list).to.deep.equal([{
            name: 'hello',
            type: 'directory',
            size: 4096,
            ctime: helloStat.ctime.getTime()
          },{
            name: 'world',
            type: 'file',
            size: 0,
            ctime: worldStat.ctime.getTime()
          }])
          done()
        })
    })

    it('create foo dir in hello dir', done => {

      request(app)
        .post('/storage/blocks/sde1')
        .query({ path: 'hello' })
        .send({ dirname: 'foo' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'hello', 'foo'), (err, stat) => {
            if (err) return done(err)
            expect(state.isDirectory()).to.be.true
            expect(res.body).to.deep.equal({
              name: 'foo',
              type: 'directory',
              size: stat.size,
              ctime: stat.ctime.getTime()
            })
          })
          done()
        })
    })

    it('upload a file in hello dir', done => {

      request(app)
        .post('/storage/blocks/sde1')
        .query({ path: 'hello' })
        .attach('file', 'testdata/alonzo_church.jpg')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'hello', 'alonzo_church.jpg'), (err, stat) => {
            if (err) return done(err)
            expect(stat.isFile()).to.be.true
            expect(res.body).to.deep.equal({
              name: 'alonzo_church.jpg',
              type: 'file',
              size: stat.size,
              ctime: stat.ctime.getTime()
            })
            done()
          })
        })
    })

    it('upload an empty file in hello dir', done => {

      request(app)
        .post('/storage/blocks/sde1')
        .query({ path: 'hello' })
        .attach('file', 'testdata/empty')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'hello', 'empty'), (err, stat) => {
            if (err) return done(err)
            expect(stat.isFile()).to.be.true
            expect(res.body).to.deep.equal({
              name: 'empty',
              type: 'file',
              size: stat.size,
              ctime: stat.ctime.getTime()
            })
            done()
          })
        })
    })

    it('delete root should fail with 403', done => {

      request(app)
        .delete('/storage/blocks/sde1')
        .query({ path: '' })
        .expect(403)
        .end(done)
    })

    it('delete hello dir', done => {
    
      request(app)    
        .delete('/storage/blocks/sde1')
        .query({ path: 'hello' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'hello'), (err, stat) => {
            expect(err).to.be.an('error')
            expect(err.code).to.equal('ENOENT')
            done()
          })
        })
    })

    it('delete world file', done => {
    
      request(app)    
        .delete('/storage/blocks/sde1')
        .query({ path: 'world' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'world'), (err, stat) => {
            expect(err).to.be.an('error')
            expect(err.code).to.equal('ENOENT')
            done()
          })
        })
    })

    it('rename hello dir to hi', done => {

      request(app)
        .patch('/storage/blocks/sde1')
        .send({ oldPath: 'hello', newPath: 'hi' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'hello'), (err, stat) => {
            expect(err).to.be.an('error')
            expect(err.code).to.equal('ENOENT')
            fs.lstat(path.join(tmptest, 'hi'), (err, stat) => {
              if (err) return done(err)
              done()
            })
          })
        })
    })

    it('rename world file to war', done => {

      request(app)
        .patch('/storage/blocks/sde1')
        .send({ oldPath: 'world', newPath: 'war' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          fs.lstat(path.join(tmptest, 'world'), (err, stat) => {
            expect(err).to.be.an('error')
            expect(err.code).to.equal('ENOENT')
            fs.lstat(path.join(tmptest, 'war'), (err, stat) => {
              if (err) return done(err)
              done()
            })
          })
        })
    })
  })
})

