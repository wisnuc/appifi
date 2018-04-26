const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const request = require('supertest')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const xattr = Promise.promisifyAll(require('fs-xattr'))
const UUID = require('uuid')
const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const debug = require('debug')('test-mkdir')
const divide = require('debug')('divider')

const app = require('src/app')
const { saveObjectAsync } = require('src/lib/utils')
const broadcast = require('src/common/broadcast')
const createBigFile = require('src/utils/createBigFile')

const Directory = require('src/vfs/directory')
const getFruit = require('src/fruitmix')

const {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync
} = require('./lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')
const DrivesDir = path.join(tmptest, 'drives')

const resetAsync = async () => {

  broadcast.emit('FruitmixStop')
  
  await Promise.delay(500)
  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)
  broadcast.emit('FruitmixStart', tmptest) 
  await broadcast.until('FruitmixStarted')
}

describe(path.basename(__filename), () => {

  let token, stat
  beforeEach(async () => {
    divide('------ I am a beautiful divider ------')
    await Promise.delay(50)
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
  }) 

  it("200 if hello does not exist, e1b8a542", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        debug(res.body)

        expect(res.body.length).to.equal(1)
        let x = res.body[0]
        expect(x.number).to.equal(0)
        expect(x.name).to.equal('hello')
        expect(x.data.hasOwnProperty('uuid')).to.be.true
        expect(x.data.type).to.equal('directory')
        expect(x.data.name).to.equal('hello')
        expect(Number.isInteger(x.data.mtime)).to.be.true

        let dirPath = path.join(DrivesDir, IDS.alice.home, 'hello')
        fs.lstat(dirPath, (err, stat) => {
          if (err) return done(err)
          expect(stat.isDirectory()).to.be.true
          done()
        })
      })
  })

  // this test is the same with above so no duplicate assert
  it("200 if hello does not exist, e227dac4", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)

        let subdirs = getFruit()
          .driveList
          .roots
          .get(IDS.alice.home)
          .children
          .filter(x => x instanceof Directory)
          .map(x => ({
            uuid: x.uuid,
            name: x.name,
            mtime: x.mtime
          }))

        expect(subdirs[0].uuid).to.equal(res.body[0].data.uuid)
        expect(subdirs[0].name).to.equal(res.body[0].data.name)
        done()
      })
  })


  it("200 if hello is a directory, batch, 3bf0913e", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {

        expect(res.body.length).to.equal(2)
        let x = res.body[0]
        expect(x.number).to.equal(0)
        expect(x.name).to.equal('hello')
        expect(x.data.hasOwnProperty('uuid')).to.be.true
        expect(x.data.type).to.equal('directory')
        expect(x.data.name).to.equal('hello')
        expect(Number.isInteger(x.data.mtime)).to.be.true
        x = res.body[1]
        expect(x.number).to.equal(1)
        expect(x.name).to.equal('hello')
        expect(x.data.hasOwnProperty('uuid')).to.be.true
        expect(x.data.type).to.equal('directory')
        expect(x.data.name).to.equal('hello')
        expect(Number.isInteger(x.data.mtime)).to.be.true

        let dirPath = path.join(DrivesDir, IDS.alice.home, 'hello')
        fs.lstat(dirPath, (err, stat) => {
          if (err) return done(err)
          expect(stat.isDirectory()).to.be.true
          done()
        })
      })
  })

  it("200 if hello is a directory, one by one, 939f6d57", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        debug(res.body)

        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'mkdir' }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            debug(res.body)

            expect(res.body.length).to.equal(1)
            let x = res.body[0]
            expect(x.number).to.equal(0)
            expect(x.name).to.equal('hello')
            expect(x.data.hasOwnProperty('uuid')).to.be.true
            expect(x.data.type).to.equal('directory')
            expect(x.data.name).to.equal('hello')
            expect(Number.isInteger(x.data.mtime)).to.be.true

            let dirPath = path.join(DrivesDir, IDS.alice.home, 'hello')
            fs.lstat(dirPath, (err, stat) => {
              if (err) return done(err)
              expect(stat.isDirectory()).to.be.true
              done()
            })
          })
      })
  })

  it("403 if hello is a file, batch, 446c8663", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(403)
      .end((err, res) => {
        if (err) return done(err)

        debug(res.body)

        let x 
        expect(res.body.length).to.equal(2)
        x = res.body[0]
        expect(x.number).to.equal(0)
        expect(x.name).to.equal('hello')
        expect(x.data.hasOwnProperty('uuid')).to.be.true
        expect(x.data.type).to.equal('file')
        expect(x.data.name).to.equal('hello')
        expect(Number.isInteger(x.data.mtime)).to.be.true
        x = res.body[1]
        expect(x.number).to.equal(1)
        expect(x.name).to.equal('hello')
        expect(x.error.code).to.equal('EEXIST')

        let filePath = path.join(DrivesDir, IDS.alice.home, 'hello')
        fs.lstat(filePath, (err, stat) => {
          if (err) return done(err)
          expect(stat.isFile()).to.be.true
          done()
        })
      })
  })

  it("403 if hello is a file, once, 62bb64f2", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        debug(res.body)

        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'mkdir' }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)

            debug(res.body)

            expect(res.body.length).to.equal(1)
            let x = res.body[0]
            expect(x.error.code).to.equal('EEXIST')
            done()
          })
      })
  })

  it("403 if hello is a file, twice, c2c93cdc", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        debug(res.body)

        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'mkdir' }))
          .field('hello', JSON.stringify({ op: 'mkdir' }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)

            debug(res.body)

            expect(res.body.length).to.equal(2)
            expect(res.body[0].error.code).to.equal('EEXIST')
            expect(res.body[1].error.code).to.equal('EDESTROYED') 
            done()
          })
      })
  })

  // this may not always succeed in real world
  // supertest stream all data into express in one tick ???
  it("403 if hello is a file, 64 times, ba4bf055", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        debug(res.body)

        let r = request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)

        for (let i = 0; i < 64; i++) r.field('hello', JSON.stringify({ op: 'mkdir' }))

        r.expect(403).end((err, res) => {
          if (err) return done(err)
        
          debug(res.body)

          expect(res.body.length).to.equal(64)
          expect(res.body[0].error.code).to.equal('EEXIST')
          for (let i = 1; i < 64; i++) expect(res.body[1].error.code).to.equal('EDESTROYED') 
          done()
        })
      })
  })
}) // end of test mkdir


