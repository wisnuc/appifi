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
    tag1 = await createTagAsync({ name: 'test1' }, 'alice')
    tag2 = await createTagAsync({ name: 'test2' }, 'alice')
    tag3 = await createTagAsync({ name: 'test3' }, 'alice')
    await new Promise((resolve, reject) => {
      let dirUUID = IDS.alice.home
      uploadTestFiles(token, IDS.alice.home, dirUUID, [], (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })

    await request(app)
      .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field('hello', JSON.stringify({ op: 'addTags', tags: [tag1.id, tag2.id] }))
      .expect(200)

  })

  it("200 get files taged tag1 should get hello", done => {
    request(app)
      .get('/files?tag=' + tag1.id)
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body).to.be.an('array')
        expect(res.body.length).to.equal(1)

        let { uuid, name, driveUUID, dirUUID } = res.body[0]
        expect(name).to.equal('hello')
        expect(driveUUID).to.equal(IDS.alice.home)
        expect(dirUUID).to.equal(IDS.alice.home)
        done()
      })
  })

})


