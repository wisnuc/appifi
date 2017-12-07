const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const chai = require('chai')
const sinon = require('sinon')
const expect = chai.expect
// const superagent = require('superagent')
const request = require('supertest')

const debug = require('debug')('test-xcopy')

const app = require('src/app')
const getFruit = require('src/fruitmix')
const broadcast = require('src/common/broadcast')

const {
  IDS,
  FILES,
  createUserAsync,
  retrieveTokenAsync,
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


describe(path.basename(__filename) + ' cp/mv a / [dir c, file d] -> dir b', () => {


  let alonzo = FILES.alonzo

  let token, dirAUUID, dirBUUID, dirCUUID, fileDUUID

  const createDir = (token, driveUUID, dirUUID, name, callback) => request(app)
    .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
    .set('Authorization', 'JWT ' + token)
    .field(name, JSON.stringify({ op: 'mkdir' }))
    .expect(200)
    .end((err, res) => {
      if (err) return callback(err)
      callback(null, res.body[0].data.uuid)
    })

  const createFile = (token, driveUUID, dirUUID, name, filePath, props, callback) => request(app)
    .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
    .set('Authorization', 'JWT ' + token)
    .attach(name, filePath, JSON.stringify(props)) 
    .expect(200)
    .end((err, res) => {
      if (err) return callback(err)
      callback(null, res.body[0].data.uuid)
    })

  const createDirAsync = Promise.promisify(createDir)
  const createFileAsync = Promise.promisify(createFile)

  beforeEach(async () => {
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    dirAUUID = await createDirAsync(token, IDS.alice.home, IDS.alice.home, 'a')
    dirCUUID = await createDirAsync(token, IDS.alice.home, dirAUUID, 'c')
    fileDUUID = await createFileAsync(token, IDS.alice.home, dirAUUID, alonzo.name, alonzo.path, { 
      size: alonzo.size, 
      sha256: alonzo.hash 
    })
    dirBUUID = await createDirAsync(token, IDS.alice.home, IDS.alice.home, 'b')
  })

  it('cp vanilla, cf94913c', done => {
    request(app)
      .post('/tasks')
      .set('Authorization', 'JWT ' + token)
      .send({
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
      })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        // console.log(res.body)
        setTimeout(done, 1000)
      })
  })

  it('mv vanilla, 6423a3e1', done => {
    request(app)
      .post('/tasks') 
      .set('Authorization', 'JWT ' + token)
      .send({
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
      })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        // console.log(res.body)
        setTimeout(done, 1000)
      })
  }) 
})

describe(path.basename(__filename) + 'mv a / [dir c, file d] -> dir b', () => {
})
