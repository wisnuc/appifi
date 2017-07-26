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

const debug = require('debug')('divider')

const app = require('src/app')
const { saveObjectAsync } = require('src/fruitmix/lib/utils')
const broadcast = require('src/common/broadcast')

const User = require('src/fruitmix/models/user')
const Drive = require('src/fruitmix/models/drive')
const Forest = require('src/fruitmix/forest/forest')

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
const forestDir = path.join(tmptest, 'drives')

const resetAsync = async () => {

  broadcast.emit('FruitmixStop')

  await broadcast.until('UserDeinitDone', 'DriveDeinitDone')
  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)
  broadcast.emit('FruitmixStart', tmptest) 
  await broadcast.until('UserInitDone', 'DriveInitDone')
}

describe(path.basename(__filename), () => {

  /**
  Scenario 01

  **/
  describe("Alice w/ empty home", () => {

    let token, stat
  
    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')

      await Promise.delay(50)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(forestDir, IDS.alice.home))
    }) 

/**
    // Get all drives
    it("GET /drives should return [alice home drive]", done => {

      // array of drive object
      let expected = [{
        uuid: IDS.alice.home,
        type: 'private',
        owner: IDS.alice.uuid,
        tag: 'home'
      }]

      request(app)
        .get('/drives')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal(expected)
          done()
        })
    })
**/

    // Get directories in alice home drive
    it("GET /drives/:home/dirs should return [alice.home]", done => {

      // array of (mapped) dir object
      let expected = [{
        uuid: IDS.alice.home,
        parent: '',
        name: IDS.alice.home,
        mtime: stat.mtime.getTime(),
      }]

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal(expected)
          done()
        })
    }) 

    // Get a single directory
    it("GET /drives/:home/dirs/:home should return { path: [alice.home], entries: [] }", done => {

      let root = {
        uuid: IDS.alice.home,
        name: IDS.alice.home,
        mtime: stat.mtime.getTime()
      }

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal({
            path: [root],
            entries: []
          })
          done()
        })
    })

    // mkdir hello
    it("POST .../entries, mkdir hello should success", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          let dirPath = path.join(forestDir, IDS.alice.home, 'hello')
          fs.lstat(dirPath, (err, stat) => {
            if (err) return done(err)
            expect(stat.isDirectory()).to.be.true
            done()
          })
        }))

    // mkdir hello and rename to world
    it("POST .../entries, mkdir hello and rename to world should success", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello|world', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {
          let helloPath = path.join(forestDir, IDS.alice.home, 'hello')
          let worldPath = path.join(forestDir, IDS.alice.home, 'world')
          fs.lstat(helloPath, err => {
            expect(err.code).to.equal('ENOENT')
            expect(fs.lstatSync(worldPath).isDirectory()).to.be.true
            done()
          })
        }))

    // mkdir hello and remove
    it("POST .../entries, mkdir hello and remove should success", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello', JSON.stringify({ op: 'remove' }))
        .expect(200)
        .end((err, res) => {
          let helloPath = path.join(forestDir, IDS.alice.home, 'hello')
          fs.lstat(helloPath, err => {
            expect(err.code).to.equal('ENOENT')
            done()
          })
        }))

    // upload empty file
    it("POST .../entries, upload empty file only", done =>
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .expect(200)
        .end((err, res) => {
          let filePath = path.join(forestDir, IDS.alice.home, 'empty')
          let stat = fs.lstatSync(filePath)
          let attr = JSON.parse(xattr.getSync(filePath, 'user.fruitmix'))
          expect(stat.isFile()).to.be.true
          expect(attr.hash).to.equal(FILES.empty.hash)
          expect(attr.magic).to.equal(0)

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              // console.log(res.body)
              done()
            })
        }))  

    // upload empty file and rename
    it("POST .../entries, upload empty file and rename to zero", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('empty', 'testdata/empty', JSON.stringify({ size: 0, sha256: FILES.empty.hash }))
        .field('empty|zero', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {

          let emptyPath = path.join(forestDir, IDS.alice.home, 'empty')
          let zeroPath = path.join(forestDir, IDS.alice.home, 'zero')

          fs.lstat(emptyPath, err => {
            expect(err.code).to.equal('ENOENT')

            let stat = fs.lstatSync(zeroPath)
            let attr = JSON.parse(xattr.getSync(zeroPath, 'user.fruitmix'))
            expect(stat.isFile()).to.be.true
            expect(attr.hash).to.equal(FILES.empty.hash)
            expect(attr.magic).to.equal(0)

            request(app)
              .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
              .set('Authorization', 'JWT ' + token)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                // console.log(res.body)
                done()
              })
            // done()
          })
        }))

    it("POST .../entries, upload alonzo file only", done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              console.log(res.body)
              done()
            })
        }))

    it('POST .../entries, upload alonzo file and rename to church', done => 
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash
        }))
        .field('alonzo.jpg|church.jpg', JSON.stringify({ op: 'rename' }))
        .expect(200)
        .end((err, res) => {

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              console.log(res.body)
              done()
            })
        }))

    it('POST .../entries, upload alonzo file and append alonzo', done =>
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
        }))
        .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({
          size: FILES.alonzo.size,
          sha256: FILES.alonzo.hash,
          append: FILES.alonzo.hash
        }))
        .expect(200)
        .end((err, res) => {

          request(app)
            .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              console.log(res.body)
              done()
            })

        }))

  })


})

