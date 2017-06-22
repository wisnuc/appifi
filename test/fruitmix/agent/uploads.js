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

const app = require('src/fruitmix/app')

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

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

global._fruitmixPath = tmptest

const tmpDir = path.join(tmptest, 'tmp')
const usersPath = path.join(tmptest, 'users.json')
const drivesPath = path.join(tmptest, 'drives.json')
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

  describe('Alice w/token, no uploads', () => {

    let sidekick

    before(async () => {
      sidekick = child.fork('src/fruitmix/sidekick/worker')      
      await Promise.delay(100)
    })

    after(async () => {
      sidekick.kill()
      await Promise.delay(100) 
    })

    let token

    beforeEach(async () => {

      Promise.delay(150)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
    }) 

    it('GET uploads should return []', done => {

      request(app)
        .get('/uploads') 
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([]) 
          done()
        })
    }) 

    it('POST upload should create new upload', async () => {

      let body ={
        descriptor: { name: 'hello' },
        size: 1024,
        segmentSize: 257
      }

      let upload = await new Promise((resolve, reject) => 
        request(app)
          .post('/uploads')
          .set('Authorization', 'JWT ' + token)
          .send(body)
          .expect(200)
          .end((err, res) => err ? reject(err) : resolve(res.body)))

      let dirPath = path.join(_fruitmixPath, 'uploads', IDS.alice.uuid)
      let entries = await fs.readdirAsync(dirPath)

      expect(entries.length).to.equal(1)

      let expected = Object.assign({}, body, {
        uuid: entries[0],
        segments: '0000' 
      })

      expect(upload).to.deep.equal(expected)
    })
  })
})

