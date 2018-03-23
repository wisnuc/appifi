const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const request = require('supertest')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const crypto = require('crypto')
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
    tag4 = await createTagAsync({ name: 'test4' }, 'alice')
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

  it("200 get files taged tag2 should get hello", done => {
    request(app)
      .get('/files?tag=' + tag2.id)
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

  it("200 get files taged tag3 should get []", done => {
    request(app)
      .get('/files?tag=' + tag3.id)
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body).to.deep.equal([])
        done()
      })
  })

  describe('hello taged [tag1, tag2], world taged [tag2, tag3]', () => {
     beforeEach(async () => {
      await request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('vpai001', JSON.stringify({ op: 'addTags', tags: [tag4.id] }))
        .expect(200)
      await request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('world', JSON.stringify({ op: 'addTags', tags: [tag2.id, tag3.id] }))
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
  
    it("200 get files taged tag3 should get world", done => {
      request(app)
        .get('/files?tag=' + tag3.id)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(1)
  
          let { uuid, name, driveUUID, dirUUID } = res.body[0]
          expect(name).to.equal('world')
          expect(driveUUID).to.equal(IDS.alice.home)
          expect(dirUUID).to.equal(IDS.alice.home)
          done()
        })
    })
  
    it("200 get files taged tag2 should get [ hello, world]", done => {
      request(app)
        .get('/files?tag=' + tag2.id)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(2)
          expect(res.body[0].name).to.equal('hello')
          expect(res.body[1].name).to.equal('world')
          done()
        })
    })

    it("200 get files taged tag4 should get [ vpai001]", done => {
      request(app)
        .get('/files?tag=' + tag4.id)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(1)
          expect(res.body[0].name).to.equal('vpai001')
          done()
        })
    })

    it("200 get files taged tag2 or tag3,  should get [ hello, world]", done => {
      request(app)
        .get(`/files?tag=${encodeURIComponent(tag2.id + '+' + tag3.id)}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(2)
          expect(res.body[0].name).to.equal('hello')
          expect(res.body[1].name).to.equal('world')
          done()
        })
    })

    it("200 get files taged tag1 or tag4,  should get [ hello, vpai001]", done => {
      request(app)
        .get(`/files?tag=${encodeURIComponent(tag1.id + '+' + tag4.id)}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(2)
          expect(res.body[0].name).to.equal('hello')
          expect(res.body[1].name).to.equal('vpai001')
          done()
        })
    })
  })
  
  describe('get file by fileUUID', () => {
    let helloUUID, vpai001UUID
    const vpai001Fingerprint = '529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb'
    const vpai001Metadata = {
      hash: vpai001Fingerprint,
      m: 'JPEG',
      w: 4624,
      h: 2608,
      orient: 1,
      date: '2017:06:17 17:31:18',
      make: 'Sony',
      model: 'G3116',
      gps: `31 deg 10' 50.67" N, 121 deg 36' 2.80" E`,
      size: 4192863
    }
    beforeEach(async () => {
      let res = await request(app)
        .get('/files?tag=' + tag1.id)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
      expect(res.body.length).to.equal(1)
      expect(res.body[0].name).to.equal('hello')
      helloUUID = res.body[0].uuid

      await request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('vpai001', JSON.stringify({ op: 'addTags', tags: [tag4.id] }))
        .expect(200)

      res = await request(app)
        .get('/files?tag=' + tag4.id)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
      expect(res.body.length).to.equal(1)
      expect(res.body[0].name).to.equal('vpai001')
      vpai001UUID = res.body[0].uuid
    })

    it('200 get hello use hello uuid', done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
      ws.on('close', () => {
        let lstat = fs.lstatSync(downloadPath)
        expect(lstat.size).to.equal(FILES.hello.size)
        done()
      })
      request(app)
        .get(`/files/${ helloUUID }`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })

    it('200 get media use uuid', done => {
      let downloadPath = path.join(tmptest, 'downloaded')
      let ws = fs.createWriteStream(path.join(tmptest, 'downloaded'))
      ws.on('close', () => {
        expect(ws.bytesWritten).to.equal(vpai001Metadata.size)
        let data = fs.readFileSync(downloadPath)
        let sha256 = crypto.createHash('sha256').update(data).digest('hex')
        expect(sha256).to.equal(vpai001Fingerprint)
        done()
      })
      request(app)
        .get(`/files/${ vpai001UUID }`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .pipe(ws)
    })
  })
})


