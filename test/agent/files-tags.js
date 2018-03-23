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
  setUserUnionIdAsync,
  createTagAsync
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

const uploadTestFiles = (token, driveUUID, dirUUID, dirs, callback) => {
  let { alonzo, bar, empty, foo, hello, vpai001, world } = FILES

  let r = request(app)
    .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
    .set('Authorization', 'JWT ' + token)
    .attach(alonzo.name, alonzo.path, JSON.stringify({
      size: alonzo.size,
      sha256: alonzo.hash
    }))
    .attach(bar.name, bar.path, JSON.stringify({
      size: bar.size,
      sha256: bar.hash
    }))
    .attach(empty.name, empty.path, JSON.stringify({
      size: empty.size,
      sha256: empty.hash
    }))
    .attach(foo.name, foo.path, JSON.stringify({
      size: foo.size,
      sha256: foo.hash
    }))
    .attach(hello.name, hello.path, JSON.stringify({
      size: hello.size,
      sha256: hello.hash
    }))
    .attach(vpai001.name, vpai001.path, JSON.stringify({
      size: vpai001.size,
      sha256: vpai001.hash
    }))
    .attach(world.name, world.path, JSON.stringify({
      size: world.size,
      sha256: world.hash
    }))

  dirs.forEach(name => r.field(name, JSON.stringify({ op: 'mkdir' })))

  r.expect(200).end((err, res) => {
    if (err) return callback(err)

    request(app)
      .get(`/drives/${driveUUID}/dirs/${dirUUID}`)
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end(callback)
  })
}

describe(path.basename(__filename), () => {

  let token, stat, tag1, tag2, tag3
  beforeEach(async () => {
    await Promise.delay(50)
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
    tag1 = await createTagAsync({ name:'test1'}, 'alice')
    tag2 = await createTagAsync({ name:'test2'}, 'alice')
    tag3 = await createTagAsync({ name:'test3'}, 'alice')
    await new Promise((resolve, reject) => {
      let dirUUID = IDS.alice.home
      uploadTestFiles(token, IDS.alice.home, dirUUID, ['dir1', 'dir2'], (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
  })

  it("200 add tag to hello", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'addTags', tags:[ tag1.id ] }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body).to.be.an('array')
        expect(res.body.length).to.equal(1)

        let { op, name, data } = res.body[0]
        expect(op).to.deep.equal('addTags')
        expect(name).to.equal('hello')
        expect(data.tags).to.be.an('array')
        expect(data.tags.length).to.equal(1)
        expect(data.tags[0]).to.equal(tag1.id)
        done()
      })
  })

  it("200 add tags to hello", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'addTags', tags:[ tag1.id, tag2.id ] }))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body).to.be.an('array')
        expect(res.body.length).to.equal(1)

        let { op, name, data } = res.body[0]
        expect(op).to.deep.equal('addTags')
        expect(name).to.equal('hello')
        expect(data.tags).to.be.an('array')
        expect(data.tags.length).to.equal(2)
        expect(data.tags[0]).to.equal(tag1.id)
        expect(data.tags[1]).to.equal(tag2.id)
        done()
      })
  })

  it("400 add invalid tag to hello", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'addTags', tags:[ 1111 ] }))
      .expect(400)
      .end((err, res) => {
        if (err) return done(err)
        done()
      })
  })

  it("200 remove file tag ", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'addTags', tags:[ tag1.id, tag2.id ] }))
      .expect(200)
      .end((err, res) => {
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'removeTags', tags:[ tag2.id ] }))
          .expect(200)
          .end((err, res) => {
            if(err) return done(err)
            expect(res.body).to.be.an('array')
            expect(res.body.length).to.equal(1)

            let { op, name, data } = res.body[0]
            expect(op).to.deep.equal('removeTags')
            expect(name).to.equal('hello')
            expect(data.tags).to.be.an('array')
            expect(data.tags.length).to.equal(1)
            expect(data.tags[0]).to.equal(tag1.id)
            done()
          })
      })
  })

  it("200  reset hello tags", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'addTags', tags:[ tag1.id, tag2.id ] }))
      .expect(200)
      .end((err, res) => {
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'resetTags' }))
          .expect(200)
          .end((err, res) => {
            if(err) return done(err)
            expect(res.body).to.be.an('array')
            expect(res.body.length).to.equal(1)

            let { op, name, data } = res.body[0]
            expect(op).to.deep.equal('resetTags')
            expect(name).to.equal('hello')
            expect(data.tags).to.equal(undefined)
            done()
          })
      })
  })

  it("200 set hello tags", done => {
    request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'addTags', tags:[ tag1.id, tag2.id ] }))
      .expect(200)
      .end((err, res) => {
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'setTags', tags:[ tag3.id] }))
          .expect(200)
          .end((err, res) => {
            if(err) return done(err)
            expect(res.body).to.be.an('array')
            expect(res.body.length).to.equal(1)

            let { op, name, data } = res.body[0]
            expect(op).to.deep.equal('setTags')
            expect(name).to.equal('hello')
            expect(data.tags).to.be.an('array')
            expect(data.tags.length).to.equal(1)
            expect(data.tags[0]).to.equal(tag3.id)
            done()
          })
      })
  })

})


