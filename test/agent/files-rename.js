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

const debug = require('debug')('test-rename')

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

/**
  - 400 if hello (identical names)
  - 400 if hello|hello (identical names)

  - 403 if hello does not exist (no overwrite)
  - 403 if hello is file, world is directory (no overwrite)
  - 403 if hello is file, world is file (no overwrite)
  - 403 if hello is directory, world is file (no overwrite)
  - 403 if hello is directory, world is directory (no overwrite)

  + 200 rename hello to world, file (no overwrite)
  + 200 rename hello to world, directory (no overwrite)

  (hello must be a file, overwriting dir is not supported)
  - 403 if hello does not exist (overwrite)
  - 403 if hello is directory (overwrite)
  - 403 if world does not exist (overwrite)
  - 403 if world is directory (overwrite)
  - 403 if world is file, uuid mismatch (overwrite)
  + 200 rename hello to world (overwrite)
*/

describe(path.basename(__filename), () => {

  let token, stat
  beforeEach(async () => {
    debug('------ I am a beautiful divider ------')
    await Promise.delay(50)
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
  }) 

  it("400 if hello (identical names), afcf3104", done => {
    request(app) 
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'rename' }))
      .expect(400)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body) 
        done()
      })
  })

  it("400 if hello|hello (identical names), e6db8c8a", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello|hello', JSON.stringify({ op: 'rename' }))
      .expect(400)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        done()
      })
  })

  it("403 if hello (fromName) does not exist (no overwrite), 4a5cbbcc", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello|world', JSON.stringify({ op: 'rename' }))
      .expect(403)
      .end((err, res) => {
        if (err) return done(err) 
        debug(res.body)
        done()
      })
  })

  it("403 if hello (fromName) is file, world is directory (no overwrite), a05e0e5b", done => {
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
          .field('hello|world', JSON.stringify({ op: 'rename' })) 
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done()
          })
      })
  })

  it("403 if hello (fromName) is file, world is file (no overwrite), 0575d2e5", done => {
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
          .field('hello|world', JSON.stringify({ op: 'rename' })) 
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done()
          })
      })
  })

  it("403 if hello is directory, world is file (no overwrite), 6b64e5ba", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
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
          .field('hello|world', JSON.stringify({ op: 'rename' })) 
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done()
          })
      })
  })

  it("403 if hello is directory, world is empty directory (no overwrite), 986c75d6", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .field('world', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)

        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ op: 'rename' })) 
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done()
          })
      })
  })

  it("403 if hello is directory, world is non-empty directory (no overwrite), 6cce5848", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .field('world', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)

        let worldUUID = res.body.find(entry => entry.name === 'world').uuid
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${worldUUID}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('foobar', JSON.stringify({ op: 'mkdir' }))
          .expect(200)
          .end((err, res) => {
            request(app)
              .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
              .set('Authorization', 'JWT ' + token)
              .field('hello|world', JSON.stringify({ op: 'rename' })) 
              .expect(403)
              .end((err, res) => {
                if (err) return done(err)
                debug(res.body)
                expect(res.body[0].error.code).to.equal('EEXIST')
                done()
              })
          })
      })
  })

  // rename does not change mtime, changing parent's mtime
  it("200 rename hello to world, file, 02e1cd61", done => {
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

        let hello = res.body[0].data
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ op: 'rename' })) 
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            expect(res.body[0].data).to.deep.equal(Object.assign(hello, { name: 'world' }))
            done()
          })
      })
  })

  it("200 rename hello to world, directory, f14098d9", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        let hello = res.body[0].data

        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ op: 'rename' }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            expect(res.body[0].data).to.deep.equal(Object.assign(hello, { name: 'world' }))
            done()
          })
       })
  })


  it("403 if hello does not exist (overwrite), 2186800f", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello|world', JSON.stringify({ 
        op: 'rename', 
        overwrite: 'b50048a7-b2d8-4345-8111-33c980bbfc06' 
      }))
      .expect(403)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)
        done()
      })
  })

  it("403 if hello is directory (overwrite), f6f9a649", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'mkdir' }))
      .field('world', JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        debug(res.body)

        let worldUUID = res.body[1].data.uuid
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ 
            op: 'rename',
            overwrite: worldUUID
          }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done()
          })
      })
  })

  it("403 if world does not exist (overwrite), b375497d", done => {
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
            op: 'rename',
            overwrite: '58be9bc2-3622-4045-83c9-c8cdb73b842b'
          }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done()
          })
      })
  })

  it("403 if world is directory (overwrite), 2c13545d", done => {
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

        let worldUUID = res.body[1].data.uuid
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ 
            op: 'rename',
            overwrite: worldUUID
          }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done(err)
          })
      })
  })

  it("403 if world is file but uuid mismatch (overwrite), 6d7743e1", done => {
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
            op: 'rename',
            overwrite: 'e48f145b-e46b-44cf-8023-603f376e357f'
          }))
          .expect(403)
          .end((err, res) => {
            if (err) return done(err)
            debug(res.body)
            done()
          })
      })
  })

  it("200 rename hello to world (overwrite), 22796908", done => {
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

        let helloUUID = res.body[0].data.uuid
        let worldUUID = res.body[1].data.uuid
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello|world', JSON.stringify({ 
            op: 'rename',
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
            })
/**
            let { type, name, size, magic, hash } = res.body.entries[0]
            expect({ type, name, size, magic, hash }).to.deep.equal({
              type: 'file',
              name: 'world',
              size: FILES.hello.size,
              magic: 0,
              hash: FILES.hello.hash
            })
**/

            fs.stat(path.join(DrivesDir, IDS.alice.home, 'hello'), err => {
              expect(err.code).to.equal('ENOENT')
              done()
            })
          })
      })
  })

})



