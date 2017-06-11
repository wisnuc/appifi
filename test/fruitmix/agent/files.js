const Promise = require('bluebird')
const path = require('path')
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
const File = require('src/fruitmix/file/file')

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
  await File.initAsync(drivesDir, tmpDir)
}

describe(path.basename(__filename), () => {

  describe("Alice w/ token", () => {
    
    let token 
    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
    })
   
    it("GET /drives should return [alice.home]", done => {
      request(app)
        .get('/drives')
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([{
            uuid: IDS.alice.home,
            type: 'private',
            owner: IDS.alice.uuid,
            tag: 'home'
          }])
          done()
        })
    }) 

    it("GET /drives/:home/dirs should return [home dir]", done => {
      request(app)
        .get(`/drives/${IDS.alice.home}/dirs`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.map(dir => ({ uuid: dir.uuid, name: dir.name })))
            .to.deep.equal([{
              uuid: IDS.alice.home,
              name: IDS.alice.home
            }])
          done()
        })
    }) 

    it("POST /drives/:home/dirs should return a new dir", done => {

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

    it("GET /drives/:home/dirs/:home should return home dir", done => {

      request(app)
        .get(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          expect(Object.assign({}, res.body, { mtime: -1 })).to.deep.equal({
            uuid: IDS.alice.home,
            parent: null,
            name: IDS.alice.home,
            mtime: -1
          })

          done()
        })
    }) 
  }) 
})
