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

const createDir = (token, driveUUID, dirUUID, name, callback) => request(app)
  .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
  .set('Authorization', 'JWT ' + token)
  .field(name, JSON.stringify({ op: 'mkdir' }))
  .expect(200)
  .end((err, res) => {
    if (err) return callback(err)
    callback(null, res.body[0].data.uuid)
  })

const createDirAsync = Promise.promisify(createDir)

const createFile = (token, driveUUID, dirUUID, name, filePath, props, callback) => request(app)
  .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
  .set('Authorization', 'JWT ' + token)
  .attach(name, filePath, JSON.stringify(props)) 
  .expect(200)
  .end((err, res) => {
    if (err) return callback(err)
    callback(null, res.body[0].data.uuid)
  })

const createFileAsync = Promise.promisify(createFile)

const createTask = (token, body, callback) => request(app)
  .post('/tasks')
  .set('Authorization', 'JWT ' + token)
  .send(body)
  .expect(200)
  .end((err, res) => err ? callback(err) : callback(null, res.body))

const createTaskAsync = Promise.promisify(createTask)

const getTask = (token, uuid, callback) => request(app)
  .get(`/tasks/${uuid}`)
  .set('Authorization', 'JWT ' + token)
  .expect(200)
  .end((err, res) => err ? callback(err) : callback(null, res.body))

const getTaskAsync = Promise.promisify(getTask)

const updateNodeByUUID = (token, taskUUID, nodeUUID, body, status, done) => request(app)
  .patch(`/tasks/${taskUUID}/nodes/${nodeUUID}`)
  .set('Authorization', 'JWT ' + token)
  .send(body)
  .expect(status)
  .end(done) 

const updateNodeByUUIDAsync = Promise.promisify(updateNodeByUUID)


describe(path.basename(__filename) + ' cp/mv a / [dir c, file d] -> dir b', () => {
  let alonzo = FILES.alonzo
  let token, dirAUUID, dirBUUID, dirCUUID, fileDUUID

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

  it('cp vanilla (assert what?), 7338eeb6', async () => {
    let task = await createTaskAsync(token, {
      type: 'copy',
      src: { drive: IDS.alice.home, dir: dirAUUID },
      dst: { drive: IDS.alice.home, dir: dirBUUID },
      entries: [dirCUUID, fileDUUID]
    })
    
    await Promise.delay(200) 
  })

  it('cp vanilla, 7797c736', done => {
    createTask(token, {
      type: 'copy',
      src: { drive: IDS.alice.home, dir: dirAUUID },
      dst: { drive: IDS.alice.home, dir: dirBUUID },
      entries: [dirCUUID, fileDUUID],
    }, (err, body) => {
      if (err) return done(err)
      setTimeout(() => getTask(token, body.uuid, (err, task) => {
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
        done()
      }), 1000)
    })
  })

  it('conflict target dir b has dir c, 3bab36a3', done => {
    createDir(token, IDS.alice.home, dirBUUID, 'c', err => {
      if (err) return done(err)
      createTask(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
      }, (err, body) => {
        if (err) return done(err)
        setTimeout(() => 
          getTask(token, body.uuid, (err, task) => {
            request(app)
              .patch(`/tasks/${body.uuid}/nodes/${dirCUUID}`)
              .set('Authorization', 'JWT ' + token)
              .send({
                policy: ['skip', null]
              })
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                setTimeout(() => 
                getTask(token, body.uuid, (err, task) => {
                  // console.log(err || task)
                  done()
                }), 100)

              })

          }), 200)
      })
    })
  })

  it('conflict dir c by dir, 5e97c3dd', async () => {
    let task

    await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')

    task = await createTaskAsync(token, {
      type: 'copy',
      src: { drive: IDS.alice.home, dir: dirAUUID },
      dst: { drive: IDS.alice.home, dir: dirBUUID },
      entries: [dirCUUID, fileDUUID],
    })

    await Promise.delay(100)

    // dir c should be in conflict state
    task = await getTaskAsync(token, task.uuid)
    expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')

    updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: ['skip', null] }, 200) 
    await Promise.delay(100)
    
    task = await getTaskAsync(token, task.uuid)

    expect(task.nodes.length).to.equal(1)
    expect(task.nodes[0].state).to.equal('Finished')
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
