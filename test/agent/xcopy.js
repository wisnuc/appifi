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

const getDriveDir = (token, dirveUUID, dirUUID, callback) => request(app)
  .get(`/drives/${dirveUUID}/dirs/${dirUUID}`)
  .set('Authorization', 'JWT ' + token)
  .expect(200)
  .end((err, res) => err ? callback(err) : callback(null, res.body))

const getDriveDirAsync = Promise.promisify(getDriveDir)

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

  it('copy parent dir into child dir, return EINVAL, db9b2c5d', async () => {
    task = await createTaskAsync(token, {
      type: 'copy',
      src: { drive: IDS.alice.home, dir: IDS.alice.home},
      dst: { drive: IDS.alice.home, dir: dirCUUID},
      entries: [dirAUUID],
      policies: { dir: ['keep'] }
    })

    await Promise.delay(100)
    task = await getTaskAsync(token, task.uuid)
    expect(task.nodes.find(n => n.src.uuid === dirAUUID).state).to.equal('Failed')
    expect(task.nodes.find(n => n.src.uuid === dirAUUID).error.code).to.equal('EINVAL')
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

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISDIR')

        updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: [value, null] }, 200)
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
      updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: ['rename'], applyToAll: true }, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')

      let dirB = await getDriveDirAsync(token, IDS.alice.home, dirBUUID)
      expect(dirB.entries.length).to.equal(5)
    })
  })

  describe('multi files conflict in different sub-dir', () => {
    let task, fileHUUID, fileIUUID
    let foo = FILES.foo
    /**
      a/
        c/
          f/
            bar
          g/
            foo
          bar
        alonzo
    **/

    beforeEach(async () => {
      let dirFUUID = await createDirAsync(token, IDS.alice.home, dirCUUID, 'f')
      fileHUUID = await createFileAsync(token, IDS.alice.home, dirFUUID, bar.name, bar.path, { 
        size: bar.size, 
        sha256: bar.hash 
      })
      let dirGUUID = await createDirAsync(token, IDS.alice.home, dirCUUID, 'g')
      fileIUUID = await createFileAsync(token, IDS.alice.home, dirGUUID, foo.name, foo.path, { 
        size: foo.size, 
        sha256: foo.hash 
      })

      // copy twice, make conflict
      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep'] }
      })
      await Promise.delay(100)

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

    it('all conflicts should be found, 5c9b3402', async () => {
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileHUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileIUUID).state).to.equal('Conflict')
    })
  })
})

describe(path.basename(__filename) + ' mv a / [dir c, file d] -> dir b', () => {
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

  it('move parent dir into child dir, return EINVAL, f3581256', async () => {
    task = await createTaskAsync(token, {
      type: 'move',
      src: { drive: IDS.alice.home, dir: IDS.alice.home},
      dst: { drive: IDS.alice.home, dir: dirCUUID},
      entries: [dirAUUID],
      policies: { dir: ['keep'] }
    })

    await Promise.delay(100)
    task = await getTaskAsync(token, task.uuid)
    expect(task.nodes.find(n => n.src.uuid === dirAUUID).state).to.equal('Failed')
    expect(task.nodes.find(n => n.src.uuid === dirAUUID).error.code).to.equal('EINVAL')
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

    it('move successfully, 36a8f076', done => {
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
      done()
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
      updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: ['rename'], applyToAll: true }, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')

      let dirB = await getDriveDirAsync(token, IDS.alice.home, dirBUUID)
      expect(dirB.entries.length).to.equal(9)
    })
  })

  describe('multi files conflict in different sub-dir', () => {
    let task, fileHUUID, fileIUUID
    let foo = FILES.foo
    /**
      a/
        c/
          f/
            bar
          g/
            foo
          bar
        alonzo
    **/

    beforeEach(async () => {
      let dirFUUID = await createDirAsync(token, IDS.alice.home, dirCUUID, 'f')
      fileHUUID = await createFileAsync(token, IDS.alice.home, dirFUUID, bar.name, bar.path, { 
        size: bar.size, 
        sha256: bar.hash 
      })
      fileIUUID = await createFileAsync(token, IDS.alice.home, dirGUUID, foo.name, foo.path, { 
        size: foo.size, 
        sha256: foo.hash 
      })

      // copy once, move once, make conflict
      task = await createTaskAsync(token, {
        type: 'copy',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { drive: IDS.alice.home, dir: dirBUUID },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep'] }
      })
      await Promise.delay(100)

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

    it('all conflicts should be found, 41811622', async () => {
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileHUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileIUUID).state).to.equal('Conflict')
    })
  })
})

// move dir a into dir b, then read dir b rapidly --error--> dir a not found (not indexed in uuid map)
describe(path.basename(__filename) + ' mv a -> b, read b concurrently', function () {
  let task, token, dirAUUID, dirBUUID, dirCUUID
  let bar = FILES.bar
  this.timeout(50000)
  beforeEach(async () => {
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    dirAUUID = await createDirAsync(token, IDS.alice.home, IDS.alice.home, 'a')
    dirBUUID = await createDirAsync(token, IDS.alice.home, IDS.alice.home, 'b')
    dirCUUID = await createDirAsync(token, IDS.alice.home, dirAUUID, 'c')
    // let fileDUUID = await createFileAsync(token, IDS.alice.home, dirCUUID, bar.name, bar.path, { 
    //     size: bar.size, 
    //     sha256: bar.hash 
    //   })
    for(let i = 0; i < 80; i++) {
      await createFileAsync(token, IDS.alice.home, dirCUUID, i, bar.path, {
        size: bar.size,
        sha256: bar.hash
      })
    }
  })

  it('move dir c -> dir b, read b, 5add0cc8', async () => {
    
    task = await createTaskAsync(token, {
      type: 'move',
      src: { drive: IDS.alice.home, dir: dirAUUID },
      dst: { drive: IDS.alice.home, dir: dirBUUID },
      entries: [dirCUUID],
      policies: { dir: ['keep'] }
    })
    // task = await getTaskAsync(token, task.uuid)

    // let result_1 = await getDriveDirAsync(token, IDS.alice.home, dirAUUID)
    let result_2 = await getDriveDirAsync(token, IDS.alice.home, dirBUUID)
    // expect(result_1.entries.length).to.equal(0)
    expect(result_2.entries.length).to.equal(1)
    expect(result_2.entries[0].uuid).to.equal(dirCUUID)
  })
})

describe(path.basename(__filename) + ' export a/[dir c, file d] -> external dir b', () => {
  let alonzo = FILES.alonzo
  let bar = FILES.bar
  let token, dirAUUID, fileDUUID, fileEUUID, dstPath

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

    dstPath = path.join(process.cwd(), 'testExport')
    await rimrafAsync(dstPath)
    await mkdirpAsync(dstPath)
  })

  afterEach(async () => {
    await rimrafAsync(dstPath)
  })

  it('export vanilla, eed4bcc7', async () => {
    let task = await createTaskAsync(token, {
      type: 'export',
      src: {drive: IDS.alice.home, dir: dirAUUID},
      dst: {path: dstPath},
      entries: [dirCUUID, fileDUUID]
    })

    await Promise.delay(100)
    task = await getTaskAsync(token, task.uuid)
    expect(task.nodes.length).to.equal(1)
    expect(task.nodes[0].state).to.equal('Finished')
  })

  describe('dir conflict, target dir has dir c', () => {
    let task
    let policyArr = ['skip', 'keep', 'rename', 'replace']
    let id = ['c5debb5c', '8401cf29', '92a4f62f', 'cd28b390']

    beforeEach(async () => {
      let dirCPath = path.join(dstPath, 'c')
      await mkdirpAsync(dirCPath)

      task = await createTaskAsync(token, {
        type: 'export',
        src: {drive: IDS.alice.home, dir: dirAUUID},
        dst: {path: dstPath},
        entries: [dirCUUID, fileDUUID]
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be Conflict, 3719ad7b', async () => {
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISDIRECTORY')
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === dirCUUID).error.xcode).to.equal('EISDIRECTORY')

        updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: [value, null] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('file conflict, target dir has file alonzo', () => {
    let fileDPath, task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['aa14724a', '21eb2951', 'adf397cf']

    beforeEach(async () => {
      fileDPath = path.join(dstPath, alonzo.name)
      fs.copyFileSync(alonzo.path, fileDPath)

      task = await createTaskAsync(token, {
        type: 'export',
        src: {drive: IDS.alice.home, dir: dirAUUID},
        dst: {path: dstPath},
        entries: [dirCUUID, fileDUUID]
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be Conflict, 3ff8626b', async () => {
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

  describe('dir conflict with file (diff), target dir has file c', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['ebaf0857', '6a6a42ee', '355cacc7']

    beforeEach(async () => {
      fileDPath = path.join(dstPath, 'c')
      fs.copyFileSync(alonzo.path, fileDPath)

      task = await createTaskAsync(token, {
        type: 'export',
        src: {drive: IDS.alice.home, dir: dirAUUID},
        dst: {path: dstPath},
        entries: [dirCUUID, fileDUUID]
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })
  
    it('state should be conflict, dc650c84', async () => {
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

  describe('file conflict with dir (diff), target dir has dir alonzo', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['e3405314', '18636b01', '0bab49a2']

    beforeEach(async () => {
      let dirCPath = path.join(dstPath, alonzo.name)
      await mkdirpAsync(dirCPath)

      task = await createTaskAsync(token, {
        type: 'export',
        src: {drive: IDS.alice.home, dir: dirAUUID},
        dst: {path: dstPath},
        entries: [dirCUUID, fileDUUID]
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, 8305ac79', done => {
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISDIRECTORY')
      done()
    })

    // it.only('resolve with skip', async () => {
    //   expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
    //   expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
    //   expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISDIRECTORY')
    //   console.log(task.nodes)
    //   updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: [null, 'replace'] }, 200)
    //   await Promise.delay(100)
    //   task = await getTaskAsync(token, task.uuid)
    //   console.log(task.nodes)
    //   expect(task.nodes.length).to.equal(1)
    //   expect(task.nodes[0].state).to.equal('Finished')
    // })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.uuid === fileDUUID).error.xcode).to.equal('EISDIRECTORY')

        updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: [ null, value ] }, 200)
        await Promise.delay(200)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('no conflict, global policies:{dir:[keep]}', () => {
    let task

    beforeEach(async () => {
      task = await createTaskAsync(token, {
        type: 'export',
        src: {drive: IDS.alice.home, dir: dirAUUID},
        dst: {path: dstPath},
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('export successfully, 37b5a41c', done => {
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
      done()
    })
  })

  describe('dir conflict, global policies:{dir:[keep]}', () => {
    let task

    beforeEach(async () => {
      let dirCPath = path.join(dstPath, 'c')
      await mkdirpAsync(dirCPath)

      task = await createTaskAsync(token, {
        type: 'export',
        src: {drive: IDS.alice.home, dir: dirAUUID},
        dst: {path: dstPath},
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('export successfully, 8dfbe219', done => {
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

      let dirCPath = path.join(dstPath, 'c')
      await mkdirpAsync(dirCPath)
      let fileEPath = path.join(dirCPath, bar.name)
      fs.copyFileSync(bar.path, fileEPath)
      let fileFPath = path.join(dirCPath, foo.name)
      fs.copyFileSync(foo.path, fileFPath)

      task = await createTaskAsync(token, {
        type: 'export',
        src: {drive: IDS.alice.home, dir: dirAUUID},
        dst: {path: dstPath},
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('file {policy:[skip], applyToAll: true}, 8f221875', async () => {
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).error.xcode).to.equal('EISFILE')
      expect(task.nodes.find(n => n.src.uuid === fileFUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileFUUID).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.uuid === fileFUUID).error.xcode).to.equal('EISFILE')

      updateNodeByUUIDAsync(token, task.uuid, fileEUUID, { policy: ['skip', null], applyToAll: true }, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)

      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
    })
  })

  describe('multi file rename', () => {
    let task

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

      let fileDPath = path.join(dstPath, alonzo.name)
      fs.copyFileSync(alonzo.path, fileDPath)
      let fileFPath = path.join(dstPath, 'alonzo_church (2).jpg')
      fs.copyFileSync(alonzo.path, fileFPath)
      let fileGPath = path.join(dstPath, 'alonzo_church (3).jpg')
      fs.copyFileSync(alonzo.path, fileGPath)
      let fileHPath = path.join(dstPath, 'alonzo_church (4).jpg')
      fs.copyFileSync(alonzo.path, fileHPath)

      task = await createTaskAsync(token, {
        type: 'export',
        src: {drive: IDS.alice.home, dir: dirAUUID},
        dst: {path: dstPath},
        entries: [dirCUUID, fileDUUID, fileFUUID, fileGUUID, fileHUUID],
        policies: {dir: ['keep']}
      })
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('the largest number should be 8, 151ad83e', async () => {
      updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: ['rename'], applyToAll: true}, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')

      let entries = fs.readdirSync(dstPath)
      expect(entries.length).to.equal(9)
    })
  })

  describe('multi files conflict in different sub-dir', () => {
    let task, fileHUUID, fileIUUID
    let foo = FILES.foo

    beforeEach(async () => {
      let dirFUUID = await createDirAsync(token, IDS.alice.home, dirCUUID, 'f')
      let dirGUUID = await createDirAsync(token, IDS.alice.home, dirCUUID, 'g')
      fileHUUID = await createFileAsync(token, IDS.alice.home, dirFUUID, bar.name, bar.path, { 
        size: bar.size, 
        sha256: bar.hash 
      })
      fileIUUID = await createFileAsync(token, IDS.alice.home, dirGUUID, foo.name, foo.path, { 
        size: foo.size, 
        sha256: foo.hash 
      })

      // export twice, make conflict
      task = await createTaskAsync(token, {
        type: 'export',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { path: dstPath },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep'] }
      })
      await Promise.delay(100)

      task = await createTaskAsync(token, {
        type: 'export',
        src: { drive: IDS.alice.home, dir: dirAUUID },
        dst: { path: dstPath },
        entries: [dirCUUID, fileDUUID],
        policies: {dir: ['keep'] }
      })
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)  
    })

    it('all conflict should be found, ada08b33', done => {
      expect(task.nodes.find(n => n.src.uuid === fileDUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileEUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileHUUID).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.uuid === fileIUUID).state).to.equal('Conflict')
      done()
    })
  })
})

describe(path.basename(__filename) + ' import external dir testImport -> a', () => {
  let alonzo = FILES.alonzo
  let bar = FILES.bar
  let token, dirAUUID, srcPath, dirCPath

  beforeEach(async () => {
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
    dirAUUID = await createDirAsync(token, IDS.alice.home, IDS.alice.home, 'a')

    srcPath = path.join(process.cwd(), 'testImport')
    await rimrafAsync(srcPath)
    await mkdirpAsync(srcPath)
    dirCPath = path.join(srcPath, 'c')
    await mkdirpAsync(dirCPath)
    let fileDPath = path.join(srcPath, alonzo.name)
    fs.copyFileSync(alonzo.path, fileDPath)
    let fileEPath = path.join(dirCPath, bar.name)
    fs.copyFileSync(bar.path, fileEPath)
  })

  afterEach(async () => {
    await rimrafAsync(srcPath)
  })

  it('import vanilla, d8e9d48b', async () => {
    let task = await createTaskAsync(token, {
      type: 'import',
      src: {path: srcPath},
      dst: {drive: IDS.alice.home, dir: dirAUUID},
      entries: ['c', alonzo.name]
    })

    await Promise.delay(150)
    task = await getTaskAsync(token, task.uuid)
    expect(task.nodes.length).to.equal(1)
    expect(task.nodes[0].state).to.equal('Finished')
  })

  describe('dir conflict, target dir has dir c', () => {
    let task
    let policyArr = ['skip', 'keep', 'rename', 'replace']
    let id = ['e1b170a7', '97d10d25', '6598991d', '77442e36']

    beforeEach(async () => {
      await createDirAsync(token, IDS.alice.home, dirAUUID, 'c')

      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name]
      })

      await Promise.delay(150)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, debd458c', done =>{
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).error.xcode).to.equal('EISDIR')
      done()
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).error.xcode).to.equal('EISDIR')

        let dirCUUID = task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).src.uuid
        updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: [value, null] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('file conflict, target dir has file alonzo', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['8e952b15', '2ab7d9f2', '8e4c9991']

    beforeEach(async () => {
      await createFileAsync(token, IDS.alice.home, dirAUUID, alonzo.name, alonzo.path, {
        size: alonzo.size,
        sha256: alonzo.hash
      })

      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name]
      })

      await Promise.delay(150)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, f9e2cbb0', done => {
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.xcode).to.equal('EISFILE')
      done()
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.xcode).to.equal('EISFILE')

        let fileDUUID = task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).src.uuid
        updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: [value] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('dir conflict with file (diff), target dir has file c', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['267b3975', '928d29da', '85bad8e8']

    beforeEach(async () => {
      await createFileAsync(token, IDS.alice.home, dirAUUID, 'c', alonzo.path, {
        size: alonzo.size,
        sha256: alonzo.hash
      })

      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name]
      })

      await Promise.delay(150)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict', done => {
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).error.xcode).to.equal('EISFILE')
      done()
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).error.xcode).to.equal('EISFILE')

        let dirCUUID = task.nodes.find(n => n.src.path === path.join(srcPath, 'c')).src.uuid
        updateNodeByUUIDAsync(token, task.uuid, dirCUUID, { policy: [null, value] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('file conflict with dir (diff), target dir has dir alonzo', () => {
    let task
    let policyArr = ['skip', 'rename', 'replace']
    let id = ['c02dbf5e', '06ffcb54', '7d497a68']

    beforeEach(async () => {
      await createDirAsync(token, IDS.alice.home, dirAUUID, alonzo.name)

      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name]
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('state should be conflict, c14dd823', done => {
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.xcode).to.equal('EISDIR')
      done()
    })

    policyArr.forEach((value, index, array) => {
      it(`resolve with ${value}, ${id[index]}`, async () => {
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).state).to.equal('Conflict')
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.code).to.equal('EEXIST')
        expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.xcode).to.equal('EISDIR')

        let fileDUUID = task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).src.uuid
        updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: [null, value] }, 200)
        await Promise.delay(100)
        task = await getTaskAsync(token, task.uuid)
        expect(task.nodes.length).to.equal(1)
        expect(task.nodes[0].state).to.equal('Finished')
      })
    })
  })

  describe('no conflict, global policies: {dir:[keep]}', () => {
    let task
    
    beforeEach(async () => {
      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('import successfully, 73df85a8', done => {
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
      done()
    })
  })

  describe('dir conflict, global policies: {dir:[keep]}', () => {
    let task

    beforeEach(async () => {
      await createDirAsync(token, IDS.alice.home, dirAUUID, 'c')

      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('import successfully, d9a49722', done => {
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
      done()
    })
  })

  describe('golbal policies:{dir:[keep]}, file in dir conflict, apply to all', () => {
    let task
    let foo = FILES.foo

    beforeEach(async () => {
      let fileFPath = path.join(dirCPath, foo.name)
      fs.copyFileSync(foo.path, fileFPath)
      // import twice, make conflict
      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('file {policy:[skip], applyToAll: true}, 8953ab8c', async () => {
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).error.xcode).to.equal('EISFILE')
      expect(task.nodes.find(n => n.src.path === path.join(dirCPath, bar.name)).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === path.join(dirCPath, bar.name)).error.code).to.equal('EEXIST')
      expect(task.nodes.find(n => n.src.path === path.join(dirCPath, bar.name)).error.xcode).to.equal('EISFILE')

      let fileDUUID = task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).src.uuid
      updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: ['skip'], applyToAll: true }, 200)
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')
    })
  })

  describe('multi file rename', () => {
    let task

    beforeEach(async () => {
      await createFileAsync(token, IDS.alice.home, dirAUUID, alonzo.name, alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      await createFileAsync(token, IDS.alice.home, dirAUUID, 'alonzo_church (2).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      await createFileAsync(token, IDS.alice.home, dirAUUID, 'alonzo_church (3).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })
      await createFileAsync(token, IDS.alice.home, dirAUUID, 'alonzo_church (4).jpg', alonzo.path, { 
        size: alonzo.size, 
        sha256: alonzo.hash 
      })

      let fileFPath = path.join(srcPath, 'alonzo_church (2).jpg')
      fs.copyFileSync(alonzo.path, fileFPath)
      let fileGPath = path.join(srcPath, 'alonzo_church (3).jpg')
      fs.copyFileSync(alonzo.path, fileGPath)
      let fileHPath = path.join(srcPath, 'alonzo_church (4).jpg')
      fs.copyFileSync(alonzo.path, fileHPath)

      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name, 'alonzo_church (2).jpg', 'alonzo_church (3).jpg','alonzo_church (4).jpg'],
        policies: {dir: ['keep']}
      })
      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('the entries length of dir a should be 9, 5240bfd5', async () => {
      let fileDUUID = task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).src.uuid
      updateNodeByUUIDAsync(token, task.uuid, fileDUUID, { policy: ['rename'], applyToAll: true}, 200)

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
      expect(task.nodes.length).to.equal(1)
      expect(task.nodes[0].state).to.equal('Finished')

      let dirA = await getDriveDirAsync(token, IDS.alice.home, dirAUUID)
      expect(dirA.entries.length).to.equal(9)
    })
  })

  describe('multi file conflict in different sub-dir', () => {
    let task, fileHPath, fileIPath
    let foo = FILES.foo

    beforeEach(async () => {
      let dirFPath = path.join(dirCPath, 'f')
      await mkdirpAsync(dirFPath)
      let dirGPath = path.join(dirCPath, 'g')
      await mkdirpAsync(dirGPath)
      fileHPath = path.join(dirFPath, bar.name)
      fs.copyFileSync(bar.path, fileHPath)
      fileIPath = path.join(dirGPath, foo.name)
      fs.copyFileSync(foo.path, fileIPath)

      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await createTaskAsync(token, {
        type: 'import',
        src: {path: srcPath},
        dst: {drive: IDS.alice.home, dir: dirAUUID},
        entries: ['c', alonzo.name],
        policies: {dir: ['keep']}
      })

      await Promise.delay(100)
      task = await getTaskAsync(token, task.uuid)
    })

    it('all conflict should be found, b8b6e1bd', done => {
      expect(task.nodes.find(n => n.src.path === path.join(srcPath, alonzo.name)).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === path.join(dirCPath, bar.name)).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === fileHPath).state).to.equal('Conflict')
      expect(task.nodes.find(n => n.src.path === fileIPath).state).to.equal('Conflict')
      done()
    })
  })
})
