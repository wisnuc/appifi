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

  Scenario 01                                 Alice w/empty home

  Dir List
  010   get dirs                              return [{alice home}]
  020 * create new dir (mkdir)                new dir xstat


  Dir                                         alice.home
  030   get a dir                             alice.home xstat
  031 * list a dir                            [] 
  032   listnav a dir                         { path: [alice.home], entries: [] }
  040 * patch a dir (rename)                  (forbidden)
  050 * delete a dir (rmdir)                  (forbidden)

  File List
  060   get files                             []
  070 * create new file (upload / new)        new file xstat

  File
  080   get a file                            n/a
  090 * patch a file (rename)                 n/a
  100 * delete a file (rm)                    n/a

  File Data
  110 * get file data (download)              n/a
  120 * put file data (upload / overwrite)    n/a

  **/
  describe("Alice w/ empty home", () => {

    let sidekick

    before(async () => {
      sidekick = child.fork('src/fruitmix/sidekick/worker')      
      await Promise.delay(100)
    })

    after(async () => {
      sidekick.kill()
      await Promise.delay(100) 
    })
    
    let token, stat

    beforeEach(async () => {

      debug('------ I am a beautiful divider ------')

      Promise.delay(150)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(forestDir, IDS.alice.home))
    })
 
/** TODO drives

    it(" should return [alice home drive] ", done => {

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
    it("010 GET /drives/:home/dirs should return [alice.home]", done => {

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

    // Create new dir in alice home drive (root)
    it("020 POST /drives/:home/dirs should return new dir", async () => {

      let dir = await new Promise((resolve, reject) => 
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs`)
          .set('Authorization', 'JWT ' + token)
          .send({ parent: IDS.alice.home, name: 'hello' })
          .expect(200)
          .end((err, res) => err ? reject(err) : resolve(res.body)))

      let dirPath = path.join(forestDir, IDS.alice.home, 'hello')
      let attr = JSON.parse(await xattr.getAsync(dirPath, 'user.fruitmix'))
      let stats = await fs.lstatAsync(dirPath)

      expect(dir).to.deep.equal({ 
        uuid: attr.uuid,
        parent: IDS.alice.home,
        name: 'hello',
        mtime: stats.mtime.getTime() 
      })

    })

    // Get a dir
    it("030 GET /drives/:home/dirs/:home should return alice.home", done => {

      let expected = {
        uuid: IDS.alice.home,
        parent: '',
        name: IDS.alice.home,
        mtime: stat.mtime.getTime()
      }

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal(expected)
          done()
        })
    }) 

    // List a dir
    it("031 GET /drives/:home/dirs/:home/list should return []", done => {

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/list`) 
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal([])
          done()
        })
    })

    // list nav a dir    
    it("032 GET /drives/:home/dirs/:home/listnav should return list [] and nav [alice.home]", done => {

      let root = {
        uuid: IDS.alice.home,
        parent: '',
        name: IDS.alice.home,
        mtime: stat.mtime.getTime()
      }

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/listnav`)
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

    // rename
    it("040 PATCH /drives/:home/dirs/:home should return 403", done => {

      request(app)
        .patch(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .send({ name: 'anything' })
        .expect(403)
        .end(done)
    })

    // delete 
    it("050 DELETE /drives/:home/dirs/:home should return 403", done => {

      request(app)
        .delete(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .expect(403)
        .end(done)
    })

    // get files
    it("060 GET /drives/:home/dirs/:home/files should return []", done => {

      request(app)
        .delete(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .expect(403)
        .end(done)
    })

    // create a new file
    it("070 POST /drives/:home/dirs/:home/files should create new file", 
      async () => {

      let file = await new Promise((resolve, reject) => 
        request(app)
          .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/files`)
          .set('Authorization', 'JWT ' + token)
          .expect(200)
          .field('size', FILES.hello.size)
          .field('sha256', FILES.hello.hash)
          .attach('file', FILES.hello.path)
          .end((err, res) => err ? reject(err) : resolve(res.body)))

      let filePath = path.join(forestDir, IDS.alice.home, 'hello')
      let attr = JSON.parse(await xattr.getAsync(filePath, 'user.fruitmix'))

      let stats = await fs.lstatAsync(filePath)

      expect(file).to.deep.equal({
        uuid: attr.uuid,
        name: 'hello',
        mtime: stats.mtime.getTime(),
        size: stats.size,
        magic: 0
      })
    })
  }) 

})

