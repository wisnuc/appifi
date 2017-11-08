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

const debug = require('debug')('test-dup')

const app = require('src/app')
const { saveObjectAsync } = require('src/lib/utils')
const broadcast = require('src/common/broadcast')
const createBigFile = require('src/utils/createBigFile')

const Magic = require('src/lib/magic')
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

  /**
  
  - 400 if hello (identical names)
  - 400 if hello|hello (identical names)

  hello|world

  - 403 if hello does not exist (no overwrite)
  - 403 if hello is a directory (no overwrite)
  - 403 if world is a directory (no overwrite)
  - 403 if world is a file (no overwrite)
  + 200 dup hello to world (no overwrite)

  - 403 if world does not exist (overwrite)
  - 403 if world is a directory (overwrite)
  - 403 if world uuid mismatch (overwrite)
  + 200 dup hello to world (overwrite)

  */
  let token, stat 
  beforeEach(async () => {
    debug('------ I am a beautiful divider ------')
    await Promise.delay(50)
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
  }) 

  it("400 if hello (identical names), 4d73acb4", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'dup' }))
      .expect(400)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        done()
      })
  })

  it("400 if hello|hello (identical names), 62dcdbe8", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'dup' }))
      .expect(400)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        done()
      })
  })

  it("403 if hello does not exist (no overwrite), f88a0575", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello|world', JSON.stringify({ op: 'dup' }))
      .expect(403)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        expect(res.body[0].error.code).to.equal('ENOENT')
        done()
      })
  })

  it("403 if hello is a directory (no overwrite), 1fb2037c", done => {
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
          .field('hello|world', JSON.stringify({ op: 'dup' }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done()
          })
      })
  })

  it("403 if world is a directory (no overwrite), d0eba276", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .field('world', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body) 

        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ op: 'dup' }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            // the underlying syscall is link, which returns EEXIST instead of EISDIR
            expect(res.body[0].error.code).to.equal('EEXIST')
            done()
          })
      })
  })

  it("403 if world is a file (no overwrite), 1c825f62", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .attach('world', 'testdata/world', JSON.stringify({
        size: FILES.world.size,
        sha256: FILES.world.hash
      }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ op: 'dup' }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            // the underlying syscall is link, which returns EEXIST instead of EISDIR
            expect(res.body[0].error.code).to.equal('EEXIST')
            done()
          })
      })
  })

  it("200 dup hello to world (no overwrite), 24a8a457", done => {
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

        let helloUUID = res.body[0].data.uuid
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ op: 'dup' }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)

            expect(res.body[0].data)
              .to.include({
                type: 'file',
                name: 'world',
                size: FILES.hello.size,
                magic: Magic.ver,
                hash: FILES.hello.hash 
              })
              .to.have.keys('uuid', 'mtime')

            // should have new (different) uuid
            expect(res.body[0].data.uuid).to.not.equal(helloUUID)

            // TODO assert disk files
            done()
          })
      })
  })

  it("403 if world does not exist (overwrite), 0978974b", done => {
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
          .field('hello|world', JSON.stringify({ 
            op: 'dup', 
            overwrite: 'b5fe21b2-8297-4475-b9db-c9c5d1a24754'
          }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            expect(res.body[0].error.code).to.equal('ENOENT')
            done()
          })
      })
  })

  it("403 if world is a directory (overwrite), a08391dc", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .field('world', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)

        let worldUUID = res.body[0].data.uuid
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ 
            op: 'dup', 
            overwrite: worldUUID
          }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            // TODO anything to assert?
            done()
          })
      })
  })

  it("403 if world uuid mismatch (overwrite), 305c609e", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .attach('world', 'testdata/world', JSON.stringify({
        size: FILES.world.size,
        sha256: FILES.world.hash
      }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)

        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ 
            op: 'dup', 
            overwrite: 'b5fe21b2-8297-4475-b9db-c9c5d1a24754'
          }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done() 
          })
      })
  })

  it("200 if dup hello to world (overwrite), 1ec83ad5", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach('hello', 'testdata/hello', JSON.stringify({
        size: FILES.hello.size,
        sha256: FILES.hello.hash
      }))
      .attach('world', 'testdata/world', JSON.stringify({
        size: FILES.world.size,
        sha256: FILES.world.hash
      }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)

        // let worldUUID = res.body.entries.find(entry => entry.name === 'world').uuid
        let worldUUID = res.body[1].data.uuid

        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ 
            op: 'dup', 
            overwrite: worldUUID
          }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)

            expect(res.body[0].data).to.include({
              uuid: worldUUID,
              type: 'file',
              name: 'world',
              size: FILES.hello.size,
              magic: Magic.ver,
              hash: FILES.hello.hash
            }).to.have.keys('mtime')

            done()
          })
      })
  })



})

