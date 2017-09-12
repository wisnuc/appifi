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
const { saveObjectAsync } = require('src/lib/utils')
const broadcast = require('src/common/broadcast')
const createBigFile = require('src/utils/createBigFile')

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

describe(path.basename(__filename), () => {
	/*
	+ 200 if hello does not exist.
  + 200 if hello is a directory.
  - 403 if hello is a file.
  */
  describe("test mkdir", () => {

    let token, stat
    beforeEach(async () => {
      debug('------ I am a beautiful divider ------')
      await Promise.delay(50)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      stat = await fs.lstatAsync(path.join(DrivesDir, IDS.alice.home))
    }) 

    it("200 if hello does not exist", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let { type, name } = res.body.entries[0]
          expect({ type, name }).to.deep.equal({
            type: 'directory',
            name: 'hello'
          })
          done()
        })
    })

    it("200 if double mkdir hello, last use parents = true ", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello', JSON.stringify({ op: 'mkdir', parents: true}))
        .expect(200)
        .end((err, res) => {
					let dirPath = path.join(DrivesDir, IDS.alice.home, 'hello')
          fs.lstat(dirPath, (err, stat) => {
            if (err) return done(err)
            expect(stat.isDirectory()).to.be.true
            done()
          })
        })
		})
		
		it("got 403 if double mkdir hello, last not use parents = true ", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(403)
        .end((err, res) => {
					expect(res.body.code).to.equal('EEXIST')
          done()
        })
    })

    it("403 if hello is a file", done => {
      request(app)
        .post(`/drives/${IDS.alice.home}/dirs/${IDS.alice.home}/entries`)
        .set('Authorization', 'JWT ' + token)
        .attach('hello', 'testdata/hello', JSON.stringify({
          size: FILES.hello.size,
          sha256: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
        }))
        .field('hello', JSON.stringify({ op: 'mkdir' }))
        .expect(403)
        .end((err, res) => {
          expect(res.body.code).to.equal('EEXIST')
          done()
        })
    })
  })
})