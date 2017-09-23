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

const debug = require('debug')('test-append')

const app = require('src/app')
const { saveObjectAsync } = require('src/lib/utils')
const broadcast = require('src/common/broadcast')
const createBigFile = require('src/utils/createBigFile')
const { createTestFilesAsync } = require('src/utils/createTestFiles')

const fingerprintSimple = require('src/utils/fingerprintSimple')

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

/*

tmptest
  /tmp
  /users.json
  /drives.json
  /drives
  /boxes

*/

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
  test append

  uuid is not required for client dont have it when immediately append onto newly created file in the same request.

  name // must be regular file
  {
    size: 0 < size <= 1GB
    sha256: segment sha256 hash
    append: existing_fingerprint
  }

  - 400 size not provided
  - 400 size is hello
  - 400 size is -1
  - 400 size is 99.99
  - 400 size is 1G + 1
  - 400 sha256 not provided
  - 400 sha256 is hello 
  - 400 append is hello

  - 403 if name does not exist
  - 403 if name is directory
  - 403 if name is empty file
  - 403 if name is alonzo (not 1GB file)

  - 400 append empty to one-giga 
  + 200 append alonzo to one-giga
  - 400 append one-giga-plus-one

  ... 

  */
  describe("test append", () => {

    let token, stat
    const REQ = () => request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)

    const NewFile = (name, file, overwrite, code, callback) => REQ()
      .attach(name, file.path, JSON.stringify({
        size: file.size,
        sha256: file.hash,
        overwrite: overwrite || undefined
      }))
      .expect(code)
      .end(callback)

    const NewFile2 = (name, file, overwrite, code, done, cb) => REQ()
      .attach(name, file.path, JSON.stringify({
        size: file.size,
        sha256: file.hash,
        overwrite: overwrite || undefined
      }))
      .expect(code)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        cb(res)
      })

    const Append = (name, file, append, code, callback) => REQ()
      .attach(name, file.path, JSON.stringify({
        size: file.size,
        sha256: file.hash,
        append
      }))
      .expect(code)
      .end(callback)

    const Append2 = (name, file, append, code, done, cb) => REQ()
      .attach(name, file.path, JSON.stringify({
        size: file.size,
        sha256: file.hash,
        append
      }))
      .expect(code)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        if (cb) {
          cb(res)
        } else {
          done()
        }
      })

    const filterMerge = (obj, names, merge) => 
      Object.assign(names.reduce((o, n) => (o[n] = obj[n], o), {}), merge)

    const nsh = (obj, merge) => filterMerge(obj, ['name', 'size', 'hash'], merge)

    const J = obj => JSON.stringify(obj)

    let { 
      alonzo, bar, empty, foo, hello, vpai001,  
      world, fiveGiga, halfGiga, oneAndAHalfGiga, 
      oneByteX, oneGiga, oneGigaMinus1, oneGigaPlusX,
      twoGiga, twoGigaMinus1, twoGigaPlusX, twoAndAHalfGiga,
      threeGiga, threeGigaMinus1, threeGigaPlusX, threeAndAHalfGiga
    } = FILES  

    before(async function () {
      this.timeout(0)

      try {
        await fs.lstatAsync('test-files')
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }

      await mkdirpAsync('test-files')

      process.stdout.write('      creating big files')
      await createTestFilesAsync()
      process.stdout.write('...done\n')
    })

    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
    }) 

    it("400 if size not provided, 77d258d1", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          sha256: FILES.alonzo.hash,
          append: FILES.hello.hash
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("400 if size is 'hello', a869f8da", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: 'hello',
          sha256: FILES.alonzo.hash,
          append: FILES.hello.hash
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("400 if size is 99.99, 009d7a68", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: 99.99,
          sha256: FILES.alonzo.hash,
          append: FILES.hello.hash
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("400 if size is -1, a4b26ba7", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: -1,
          sha256: FILES.alonzo.hash,
          append: FILES.hello.hash
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("400 if size is 0, 970b74a6", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: 0,
          sha256: FILES.empty.hash,
          append: FILES.hello.hash
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("400 if size is 1G + 1, 408c6181", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: 1024 * 1024 * 1024 + 1,
          sha256: FILES.alonzo.hash,
          append: FILES.hello.hash
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("400 if sha256 is not provided, a5c130be", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          append: FILES.hello.hash
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("400 if sha256 is 'hello', a75e2a9a", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: 'hello',
          append: FILES.hello.hash
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })

    it("400 if append is 'hello', 4fbfa3f9", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
          append: 'hello'
        }))
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
    })   

    it("403 if name does not exist, 415af27e", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
          append: FILES.hello.hash
        }))
        .expect(403)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)
          expect(res.body.length).to.equal(1)
          expect(res.body[0].error.code).to.equal('ENOENT')
          done()
        })
    }) 

    it("403 if name is directory, 66bb6713", done => {
      REQ()
        .field('alonzo.jpg', J({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          REQ()
            .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash,
              append: FILES.hello.hash
            }))
            .expect(403)
            .end((err, res) => {
              if (err) return done(err)
              debug(res.body)
              expect(res.body.length).to.equal(1)
              // this error code is faked, hence no syscall assertion
              expect(res.body[0].error.code).to.equal('EISDIR')
              done()
            }) 
        })
    })

    // target size cannot be 0
    it("403 if target is an empty file, 8ed2c7f0", done => {
      REQ()
        .attach('empty', 'testdata/empty', J({ size: 0 }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)

          REQ()
            .attach('empty', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash,
              append: FILES.empty.hash
            }))
            .expect(403)
            .end((err, res) => {
              if (err) return done(err)              
              debug(res.body)
              done()
            })
        })
    })

    // target size must be multiple of 1G
    it("403 if append alonzo to alonzo, 80b85342", done => {
      REQ()
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({ 
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          debug(res.body)

          REQ()
            .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', J({
              size: FILES.alonzo.size,
              sha256: FILES.alonzo.hash,
              append: FILES.alonzo.hash
            }))
            .expect(403)
            .end((err, res) => {
              if (err) return done(err)
              debug(res.body)
              done()
            })
        })
    })

    /** append to empty is allowed, append empty to anything is disallowed **/

    it("400 append empty to empty, 818066c4", function (done) {
      NewFile('empty', empty, null, 200, (err, res) => {
        if (err) return done(err)
        debug(res.body)

        Append('empty', empty, empty.hash, 400, (err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
      })
    })

    it("400 append empty to alonzo, 89b12a0c", function (done) {
      NewFile('alonzo', alonzo, null, 200, (err, res) => {
        if (err) return done(err)
        debug(res.body)
        
        Append('empty', empty, empty.hash, 400, (err, res) => {
          if (err) return done(err)
          debug(res.body)
          done()
        })
      })
    })

    it("400 append empty to one-giga, debe6ba8", function (done) {
      this.timeout(0)
      NewFile2('one-giga', oneGiga, null, 200, done, res => 
        Append2('empty', empty, empty.hash, 400, done, res => {
          expect(res.body[0].error.status).to.equal(400)
          done()
        }))
    }) 

    it("400 append empty to two-giga, 8730cc93", function (done) {
      this.timeout(0)
      NewFile2('two-giga', oneGiga, null, 200, done, res =>
        Append2('two-giga', oneGiga, oneGiga.hash, 200, done, res => 
          Append2('two-giga', empty, empty.hash, 400, done)))
    })

    it("200 append x to empty, 32bec068", function (done) {
      NewFile2('empty', empty, null, 200, done, res => {
        Append2('empty', oneByteX, oneByteX.hash, 200, done, res => {
          expect(res.body[0].data)
            .to.include({
              type: 'file',
              name: 'empty',
              size: 1,
              magic: 0,
              hash: oneByteX.hash
            })
            .to.have.keys('uuid', 'mtime')
          done()
        })
      })
    })

    it("200 append x to one-giga, fa085355", function (done) {
      this.timeout(0)
      NewFile2('one-giga', oneGiga, null, 200, done, res =>
        Append2('one-giga', oneByteX, oneGiga.hash, 200, done, res => {
/**
          expect(nsh(res.body.entries[0]))
            .to.deep.equal(nsh(oneGigaPlusX, { name: 'one-giga' })) 
**/
          expect(res.body[0].data)
            .include({
            })
            .to.have.keys()
          done()
        }))
    })

    it("200 append half-giga to one-giga", function (done) {
      this.timeout(0)
      NewFile('one-giga', oneGiga, null, 200, (err, res) => err ? done(err)
        : Append('one-giga', halfGiga, oneGiga.hash, 200, (err, res) => {
            if (err) return done(err)
            expect(nsh(res.body.entries[0]))
              .to.deep.equal(nsh(oneAndAHalfGiga, { name: 'one-giga' })) 
            done()
          }))
    })

    it("200 append one-giga-minus-1 to one-giga", function (done) {
      this.timeout(0)
      NewFile('one-giga', oneGiga, null, 200, (err, res) => err ? done(err)
        : Append('one-giga', oneGigaMinus1, oneGiga.hash, 200, (err, res) => {
            if (err) return done(err)
            expect(nsh(res.body.entries[0]))
              .to.deep.equal(nsh(twoGigaMinus1, { name: 'one-giga' })) 
            done()
          }))
    })

    it("200 append one-giga to one-giga", function (done) {
      this.timeout(0)
      NewFile('one-giga', oneGiga, null, 200, (err, res) => err ? done(err)
        : Append('one-giga', oneGiga, oneGiga.hash, 200, (err, res) => {
            if (err) return done(err)
            expect(nsh(res.body.entries[0])).to.deep.equal(nsh(twoGiga, { name: 'one-giga' })) 
            done()
          }))
    })

    it("400 append one-giga-plus-x to one-giga", function (done) {
      this.timeout(0)
      NewFile('one-giga', oneGiga, null, 200, (err, res) => err ? done(err)
        : Append('one-giga', oneGigaPlusX, oneGiga.hash, 400, done()))
    })

    it("200 append x to two-giga", function (done) {
      this.timeout(0)
      NewFile('two-giga', oneGiga, null, 200, (err, res) => {
        if (err) return done(err)
        Append('two-giga', oneGiga, oneGiga.hash, 200, (err, res) => { 
          if (err) return done(err)
          Append('two-giga', oneByteX, twoGiga.hash, 200, (err, res) => {
            if (err) return done(err)
            expect(nsh(res.body.entries[0])).to.deep.equal(nsh(twoGigaPlusX, { name: 'two-giga' }))
            done()
          })
        })
      })
    })

    it("200 append half-giga to two-giga", function (done) {
      this.timeout(0)
      NewFile('two-giga', oneGiga, null, 200, (err, res) => {
        if (err) return done(err)
        Append('two-giga', oneGiga, oneGiga.hash, 200, (err, res) => {
          if (err) return done(err)
          Append('two-giga', halfGiga, twoGiga.hash, 200, (err, res) => {
            if (err) return done(err)
            expect(nsh(res.body.entries[0])).to.deep.equal(nsh(twoAndAHalfGiga, { name: 'two-giga' }))
            done()
          })
        })
      }) 
    })

    it("200 append one-giga-minus-1 to two-giga", function (done) {
      this.timeout(0)
      NewFile('target', oneGiga, null, 200, (err, res) => {
        if (err) return done(err)
        Append('target', oneGiga, oneGiga.hash, 200, (err, res) => {
          if (err) return done(err)
          Append('target', oneGigaMinus1, twoGiga.hash, 200, (err, res) => {
            if (err) return done(err)
            expect(nsh(res.body.entries[0])).to.deep.equal(nsh(threeGigaMinus1, { name: 'target' }))
            done()
          })
        })
      }) 
    })

  }) 
})

