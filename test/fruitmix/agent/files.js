const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const request = require('supertest')
const superagent = require('superagent')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const debug = require('debug')('divider')

const app = require('src/fruitmix/app')
const { saveObjectAsync } = require('src/fruitmix/lib/utils')

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

global._fruitmixPath = tmptest

const tmpDir = path.join(tmptest, 'tmp')
const usersPath = path.join(tmptest, 'users.json')
const drivesPath = path.join(tmptest, 'drives.json')
const drivesDir = path.join(tmptest, 'drives')

/**
Reset directories and reinit User module
*/
const resetAsync = async() => {

  await rimrafAsync(tmptest) 
  await mkdirpAsync(tmpDir) 
  
  await User.initAsync(usersPath, tmpDir)
  await Drive.initAsync(drivesPath, tmpDir)
  await Forest.initAsync(drivesDir)
}

/**

010   get dirs
020 * create a dir (mkdir)

030   get a dir
031 * get a dir alt1 (list / readdir)
032   get a dir alt2 (listnav)
040 * patch a dir (rename)
050 * delete a dir (rmdir)

060   get files
070 * create a new file (upload / new)

080   get a file
090 * patch a file (rename)
100 * delete a file (rm)

110 * get file data (download)
120 * put file data (upload / overwrite)

**/

describe(path.basename(__filename), () => {

  describe("Alice w/ token and empty home", () => {

    let sidekick

    before(async () => {
      sidekick = child.fork('src/fruitmix/sidekick/worker')      
      await Promise.delay(300)
    })

    after(async () => {
      sidekick.kill()
      await Promise.delay(300) 
    })
    
    let token, stat

    beforeEach(async () => {

      debug('------ I am a beautiful divider ------')
      Promise.delay(150)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(drivesDir, IDS.alice.home))
    })
  
    it("GET /drives should return [alice home drive] ", done => {

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

    // get all directories in a drive
    it("GET /drives/:home/dirs should return [alice home dir] 01", done => {

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


    // create a new directory in a drive
    it("POST /drives/:home/dirs should return a new dir {hello} 02", done => {

      let uuid1 = '26a808bd-9a7d-474d-ac4d-9b733b60f93f'
      sinon.stub(UUID, 'v4').returns(uuid1)
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs`)
        .set('Authorization', 'JWT ' + token)
        .send({ parent: IDS.alice.home, name: 'hello' })
        .expect(200)
        .end((err, res) => {

          UUID.v4.restore()
          if (err) return done(err)

          let { uuid, name } = res.body
          expect({ uuid, name }).to.deep.equal({
            uuid: uuid1,
            name: 'hello'
          })
          done()

        })
    })

    // get single dir in a drive
    it("GET /drives/:home/dirs/:home should return {home dir} 03", done => {

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          expect(res.body).to.deep.equal({
            uuid: IDS.alice.home,
            parent: '',
            name: IDS.alice.home,
            mtime: stat.mtime.getTime()
          })

          done()
        })
    }) 

    // list a dir
    it("GET /drives/:home/dirs/:home/list list home should return [] 04", done => {

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/list`) 
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal([])
          done()
        })
    })

/**
    // list nav a dir    
    it("GET /drives/:home/dirs/:home/listnav list nav home should return 05", done => {

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/listnav`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal({})
          done()
        })
    })
**/

    // create a new file
    it("POST should create a file hello in alice home", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/files`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .field('size', FILES.hello.size)
        .field('sha256', FILES.hello.hash)
        .attach('file', FILES.hello.path)
        .end((err, res) => {
          if (err) return done(err)
          done()
        })
    })
  }) 
})

