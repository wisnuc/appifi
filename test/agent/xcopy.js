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


describe(path.basename(__filename) + ' cp a / [dir c, file d] -> dir b', () => {
  let alonzo = FILES.alonzo
  let bar = FILES.bar
  let token, dirAUUID, dirBUUID, dirCUUID, fileDUUID, fileEUUID

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
    fileEUUID = await createFileAsync(token, IDS.alice.home, dirCUUID, bar.name, bar.path, { 
      size: bar.size, 
      sha256: bar.hash 
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

  describe('dir conflict, target dir b has dir c', () => {
    let task
    let policyArr = ['skip', 'keep', 'rename', 'replace']
    let id = ['b320292b', '1c9a0ec1', '3d75d301', '60b624b0']

    beforeEach(async () => {
      await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')

      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })
  
    it('state should be conflict, eef68f1c', async () => {
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISDIR')
    })

    policyArr.forEach((current, index, array) => {
      it(`resolve with ${current}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISDIR')

        updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: [current, null] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
    
  })

  describe('file conflict, target dir b has file alonzo', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['30f1ad48', 'a49b3137', 'd98389c1']

    beforeEach(async () => {
      await createFileAsync(token, IDS.alice.home, dirBUUID, alonzo.name, alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })

      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, 170986ff', async () => {
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISFILE')
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISFILE')

        updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: [value, null] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('dir conflict with file (diff), target dir b has file c', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['32004d8e', 'e0da3a39', '9ee0d879']

    beforeEach(async () => {
      await createFileAsync(token, IDS.alice.home, dirBUUID, 'c', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })

      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })
  
    it('state should be conflict, 29a07147', async () => {
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISFILE')
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISFILE')

        updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: [null, value] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('file conflict with dir (diff), target dir b has dir alonzo', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['0ee0c3da', 'c069e188', 'f2939798']

    beforeEach(async () => {
      await createDirAsync(token, IDS.alice.home, dirBUUID, alonzo.name)

      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, 77cc8c76', async () => {
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISDIR')
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISDIR')

        updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: [null, value] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('dif conflict, global policies:{dir:[keep]}', () => {
    let task

    beforeEach(async () => {
      await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')

      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep'] }
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('dir c should be kept, e68f5660', done => {
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
      done()
    })
  })

  describe('no conflict, global policies:{dir:[keep]}', () => {
    let task

    beforeEach(async () => {

      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep'] }
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('copy success, 395c3f15', done => {
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
      done()
    })
  })

  describe('global policies:{dir:[keep]}, file in dir conflict, apply to all', () => {
    let task, fileFUUID
    let foo = FILES.foo

    beforeEach(async () => {
      fileFUUID = await createFileAsync(token, IDS.alice.home, dirCUUID, foo.name, foo.path, { 
        size: foo.size, 
        sha256: foo.hash 
      })

      await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')
      let dirCUUID_1 = await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')
      await createFileAsync(token, IDS.alice.home, dirCUUID_1, bar.name, bar.path, { 
        size: bar.size, 
        sha256: bar.hash 
      })

      await createFileAsync(token, IDS.alice.home, dirCUUID_1, foo.name, foo.path, { 
        size: foo.size, 
        sha256: foo.hash 
      })

      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep'] }
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('file {policy:[skip], applyToAll: true}, 99dd711f', async () => {
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).error.xcode).to.equal('EISFILE')

      updateNodeByUUIDAsync(token, task.uuid, fileEUUID, { policy: ['skip', null], applyToAll: true }, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)

      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
    })
  })

  describe('multi file rename', () => {
    let task, fileFUUID, fileDUUID_1, fileFUUID_1
    beforeEach(async () => {
      fileFUUID = await createFileAsync(token, IDS.alice.home, dirAUUID, 'alonzo_church (2).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      fileDUUID_1 = await createFileAsync(token, IDS.alice.home, dirBUUID, alonzo.name, alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      fileFUUID_1 = await createFileAsync(token, IDS.alice.home, dirBUUID, 'alonzo_church (2).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })

      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID, fileFUUID],
        policies: {dir: ['keep'] }
      })
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('the largest number should be 4, ff9eaf36', async () => {
      updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: ['rename'] }, 200)
      updateNodeByUUIDAsync(token, task.uuid, fileFUUID, { policy: ['rename'] }, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
    })
  })
})

describe(path.basename(__filename) + 'mv a / [dir c, file d] -> dir b', () => {
  let alonzo = FILES.alonzo
  let bar = FILES.bar
  let token, dirAUUID, dirBUUID, dirCUUID, fileDUUID, fileEUUID

  beforeEach(async () => {
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    dirAUUID = await createDirAsync(token, IDS.alice.home, IDS.alice.home, 'a')
    dirCUUID = await createDirAsync(token, IDS.alice.home, dirAUUID, 'c')
    dirGUUID = await createDirAsync(token, IDS.alice.home, dirCUUID, 'g')
    fileDUUID = await createFileAsync(token, IDS.alice.home, dirAUUID, alonzo.name, alonzo.path, { 
      size: alonzo.size, 
      sha256: alonzo.hash 
    })
    fileEUUID = await createFileAsync(token, IDS.alice.home, dirCUUID, bar.name, bar.path, { 
      size: bar.size, 
      sha256: bar.hash 
    })
    dirBUUID = await createDirAsync(token, IDS.alice.home, IDS.alice.home, 'b')
  })

  it('mv vanilla, 6423a3e1', async () => {
    let task = await createTaskAsync(token, {
      type: 'move',
      src: { drive: IDS.alice.home, dir: dirAUUID },
      dst: { drive: IDS.alice.home, dir: dirBUUID },
      entries: [dirCUUID, fileDUUID]
    })

    await Promise.delay(100)
    task = await getTaskAsync(token, task.uuid)
    expect(task.nodes.length).to.equal(1)
    expect(task.nodes[0].state).to.equal('Finished')
  })

  describe('dir conflict, target dir b has dir c', () => {
    let task
    let policyArr = ['keep', 'skip', 'rename', 'replace']
    let id = ['bab8b468', '3aa7751d', '7577c66e', '162673a3']

    beforeEach(async () => {
      await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')

      task = await createTaskAsync(token, {
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID]
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, b68ae7d0', done => {
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISDIR')
      done()
    })
    
    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISDIR')

        updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: [ value ] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('file conflict, target dir b has file alonzo', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['e541a40e', '64f054f3', '32d010ed']

    beforeEach(async () => {
      await createFileAsync(token, IDS.alice.home, dirBUUID, alonzo.name, alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })

      task = await createTaskAsync(token, {
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID]
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, d3387ee9', done => {
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISFILE')
      done()
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISFILE')

        updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: [ value ] }, 200)
        await Promise.delay(200)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  }) 

  describe('dir conflict with file (diff), target dir b has file c', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['5363443c', 'd44a3539', '31ef9b61']

    beforeEach(async () => {
      await createFileAsync(token, IDS.alice.home, dirBUUID, 'c', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })

      task = await createTaskAsync(token, {
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID]
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, EISFILE, 0efc3b89', done => {
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISFILE')
      done()
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISFILE')

        updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: [ null, value ] }, 200)
        await Promise.delay(200)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('file conflict with dir (diff), target dir b has dir alonzo', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['76fe2931', '533f1d36', '0422e6b4']

    beforeEach(async () => {
      await createDirAsync(token, IDS.alice.home, dirBUUID, alonzo.name)

      task = await createTaskAsync(token, {
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, 8dbd3515', async () => {
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISDIR')
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISDIR')

        updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: [null, value] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('no conflict, golbal policies: {dir: [keep]}', () => {
    let task

    beforeEach(async () => {
      task = await createTaskAsync(token, {
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('move successfully, 36a8f076', async () => {
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
    })
  })

  describe('dif conflict, global policies:{dir: [keep]}', () => {
    let task

    beforeEach(async () => {
      let dirCUUID_1 = await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')
      await createDirAsync(token, IDS.alice.home, dirCUUID_1, 'g')

      task = await createTaskAsync(token, {
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('move successfully, 6f262d24', async () => {
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
    })
  })

  describe('global policies:{dir:[keep]}, file in dir conflict, apply to all', () => {
    let task, fileFUUID
    let foo = FILES.foo

    beforeEach(async () => {
      await createFileAsync(token, IDS.alice.home, dirCUUID, foo.name, foo.path, { 
        size: foo.size, 
        sha256: foo.hash 
      })
      await createFileAsync(token, IDS.alice.home, dirCUUID, alonzo.name, alonzo.path, {
        size: alonzo.size,
        sha256: alonzo.hash
      })

      await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')
      let dirCUUID_1 = await createDirAsync(token, IDS.alice.home, dirBUUID, 'c')
      await createFileAsync(token, IDS.alice.home, dirCUUID_1, bar.name, bar.path, { 
        size: bar.size, 
        sha256: bar.hash 
      })
      await createFileAsync(token, IDS.alice.home, dirCUUID_1, foo.name, foo.path, { 
        size: foo.size, 
        sha256: foo.hash 
      })

      task = await createTaskAsync(token, {
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep'] }
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('file {policy:[skip], applyToAll: true}, f63ee747', async () => {
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).error.xcode).to.equal('EISFILE')

      updateNodeByUUIDAsync(token, task.uuid, fileEUUID, { policy: ['skip', null], applyToAll: true }, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
      
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
    })
  })

  describe('multi file rename', () => {
    let task, fileFUUID, fileDUUID_1, fileFUUID_1
    beforeEach(async () => {
      fileFUUID = await createFileAsync(token, IDS.alice.home, dirAUUID, 'alonzo_church (2).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      fileGUUID = await createFileAsync(token, IDS.alice.home, dirAUUID, 'alonzo_church (3).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      fileHUUID = await createFileAsync(token, IDS.alice.home, dirAUUID, 'alonzo_church (4).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })

      await createFileAsync(token, IDS.alice.home, dirBUUID, alonzo.name, alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      await createFileAsync(token, IDS.alice.home, dirBUUID, 'alonzo_church (2).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      await createFileAsync(token, IDS.alice.home, dirBUUID, 'alonzo_church (3).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      await createFileAsync(token, IDS.alice.home, dirBUUID, 'alonzo_church (4).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })

      task = await createTaskAsync(token, {
        type: 'move',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID, fileFUUID, fileGUUID, fileHUUID],
        policies: {dir: ['keep'] }
      })
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('the largest number should be 8, 98382680', async () => {
      updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: ['rename'] }, 200)
      updateNodeByUUIDAsync(token, task.uuid, fileFUUID, { policy: ['rename'] }, 200)
      updateNodeByUUIDAsync(token, task.uuid, fileGUUID, { policy: ['rename'] }, 200)
      updateNodeByUUIDAsync(token, task.uuid, fileHUUID, { policy: ['rename'] }, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
    })
  })


})
