const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const request = require('supertest')
const superagent = require('superagent')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const app = require('src/fruitmix/app')
const { saveObjectAsync } = require('src/fruitmix/lib/utils')

const User = require('src/fruitmix/user/user')
const Drive = require('src/fruitmix/drive/drive')
const Forest = require('src/fruitmix/forest/forest')

const {
  IDS,
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

describe(path.basename(__filename), () => {

  describe("Alice w/ token", () => {
    
    let token, stat
    beforeEach(async () => {
      console.log('------ I am a beautiful divider ------')
      Promise.delay(100)
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
    it("GET /drives/:home/dirs should return [alice home dir]", done => {

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
    it("POST /drives/:home/dirs should return a new dir {hello}", done => {

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
    it("GET /drives/:home/dirs/:home should return {home dir}", done => {

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
    it("GET /drives/:home/dirs/:home/list list home should return []", done => {

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
    it("GET /drives/:home/dirs/:home/listnav list nav home should return", done => {

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
  }) 
})

