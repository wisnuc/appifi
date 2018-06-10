const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const fakeNfsAsync = require('test/lib/nfs')

const Watson = require('phi-test/lib/watson')

const { UUIDDE } = fakeNfsAsync

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const FILES = require('../lib').FILES

const { alonzo, foo } = FILES

const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'alice'
}

/**
This is the create Task operation spec function

@param {object} a - predefined
@param {object} b - parameter

@returns c
*/
const assertTask = (args, task) => {
  if (args.stepping === true) {
    // missing uuid
    expect(task.type).to.equal(args.type)
    expect(task.src).to.deep.equal(args.src)
    expect(task.dst).to.deep.equal(args.dst)
    expect(task.entries).to.deep.equal(task.entries)
    expect(task.nodes).to.deep.equal([])
    expect(task.finished).to.equal(false)
    expect(task.stepping).to.equal(true)
    expect(task.steppingState).to.equal('Stopped')
  }
}

const cdir = [{
  type: 'directory',
  name: 'foo'
}]

const cfoo = [{
  type: 'file',
  name: 'foo',
  file: foo.path,
  size: foo.size,
  sha256: foo.hash
}]

const calonzo = [{
  type: 'file',
  name: 'foo',
  file: alonzo.path,
  size: alonzo.size,
  sha256: alonzo.hash
}]

/**
file, no conflict
dir, no conflict

file, target is file
file, target is dir
dir, target is file
dir, target is dir
*/
const singletons = {
  file: [
    { type: 'directory', name: 'dst' },
    { type: 'directory', name: 'src', children: calonzo }
  ],

  dir: [
    { type: 'directory', name: 'dst' },
    { type: 'directory', name: 'src', children: cdir }
  ],

  fileFile: [
    { type: 'directory', name: 'dst', children: cfoo },
    { type: 'directory', name: 'src', children: calonzo }
  ],

  fileDir: [
    { type: 'directory', name: 'dst', children: cdir },
    { type: 'directory', name: 'src', children: calonzo }
  ],

  dirFile: [
    { type: 'directory', name: 'dst', children: cfoo },
    { type: 'directory', name: 'src', children: cdir }
  ],

  dirDir: [
    { type: 'directory', name: 'dst', children: cdir },
    { type: 'directory', name: 'src', children: cdir }
  ]
}

describe('xcopy task', () => {
  let watson, user

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(fruitmixDir)
    let fake = await fakeNfsAsync(tmptest)
    let boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

    let userFile = path.join(fruitmixDir, 'users.json')
    await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

    let opts = { fruitmixDir, boundVolume }
    let fruitmix = new Fruitmix(opts)
    let app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
    await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))

    watson = new Watson({ app })
    await new Promise((resolve, reject) =>
      watson.login('alice', 'alice', err =>
        err ? reject(err) : resolve()))

    fruitmix.nfs.update(fake.storage)
    user = watson.users.alice
  })

  it('copy, file, no conflict', async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.file
    })

    let copyArgs = {
      type: 'copy',
      src: {
        drive: user.home.uuid,
        dir: c1[1].xstat.uuid
      },
      dst: {
        drive: user.home.uuid,
        dir: c1[0].xstat.uuid
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(copyArgs)
    assertTask(copyArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length === 2)
    expect(next.step.nodes.find(n => !n.parent).state).to.equal('Parent')
    expect(next.step.nodes.find(n => n.src.name === 'foo').state).to.equal('Working')

    expect(next.watch.nodes.length === 0)
    expect(next.watch.finished).to.equal(true)
  })

  //    let c2 = await user.mktreeAsync({ type: 'nfs', drive: UUIDDE, dir: '', children })

  it('copy, dir, no conflict, 21697e0b', async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.dir
    })

    let copyArgs = {
      type: 'copy',
      src: {
        drive: user.home.uuid,
        dir: c1[1].xstat.uuid
      },
      dst: {
        drive: user.home.uuid,
        dir: c1[0].xstat.uuid
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(copyArgs)
    assertTask(copyArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(2)
    expect(next.step.nodes[0].state).to.equal('Preparing')
    expect(next.step.nodes[1].state).to.equal('Parent')

    expect(next.watch.nodes).to.deep.equal([])
    expect(next.watch.finished).to.equal(true)

    // TODO assert file system
  })

  it("copy, file/file, ['skip', null], d3bfeae3", async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.fileFile
    })

    let copyArgs = {
      type: 'copy',
      src: {
        drive: user.home.uuid,
        dir: c1[1].xstat.uuid
      },
      dst: {
        drive: user.home.uuid,
        dir: c1[0].xstat.uuid
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(copyArgs)

    assertTask(copyArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(2)
    expect(next.step.nodes[0].state).to.equal('Working')
    expect(next.step.nodes[1].state).to.equal('Parent')

    expect(next.watch.nodes.length).to.equal(2)
    expect(next.watch.nodes[0].state).to.equal('Conflict')
    expect(next.watch.nodes[1].state).to.equal('Parent')

    let nodeUUID = next.watch.nodes[0].src.uuid
    let policy = ['skip', null]
    next = await user.patchTaskAsync(task.uuid, nodeUUID, { policy })

    expect(next.patch.nodes.length).to.equal(2)
    expect(next.patch.nodes[0].state).to.equal('Working')

    expect(next.watch.nodes.length).to.equal(0)
    expect(next.watch.finished).to.equal(true)
  })

  it("copy, dir/dir, ['skip', null] c8084071", async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.dirDir
    })

    let copyArgs = {
      type: 'copy',
      src: {
        drive: user.home.uuid,
        dir: c1[1].xstat.uuid
      },
      dst: {
        drive: user.home.uuid,
        dir: c1[0].xstat.uuid
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(copyArgs)

    assertTask(copyArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    // first step, root @ Preparing
    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    // first watch, root @ Parent
    expect(next.watch.nodes.length).to.equal(2)
    expect(next.watch.nodes[0].state).to.equal('Conflict')
    expect(next.watch.nodes[1].state).to.equal('Parent')

    let nodeUUID = next.watch.nodes[0].src.uuid
    let policy = ['skip', null]
    next = await user.patchTaskAsync(task.uuid, nodeUUID, { policy })

    expect(next.patch.nodes.length).to.equal(2)
    expect(next.patch.nodes[0].state).to.equal('Mkdir')

    expect(next.watch.nodes.length).to.equal(0)
  })

  it('move, file, no conflict', async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.file
    })

    let moveArgs = {
      type: 'move',
      src: {
        drive: user.home.uuid,
        dir: c1[1].xstat.uuid
      },
      dst: {
        drive: user.home.uuid,
        dir: c1[0].xstat.uuid
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(moveArgs)

    assertTask(moveArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    // only file, no mvdirs
    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')
    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(2)
    expect(next.step.nodes[0].state).to.equal('Working') // moving

    expect(next.watch.nodes.length).to.equal(0) // finish
  })

  it('move, dir, no conflict, a1ad01e3', async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.dir
    })

    let moveArgs = {
      type: 'move',
      src: {
        drive: user.home.uuid,
        dir: c1[1].xstat.uuid
      },
      dst: {
        drive: user.home.uuid,
        dir: c1[0].xstat.uuid
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(moveArgs)

    assertTask(moveArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    // root preparing
    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    // root parent
    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    // foo preparing
    expect(next.step.nodes.length).to.equal(2)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    // foo finished and root finished
    expect(next.watch.nodes.length).to.equal(0)
  })

  it('import, file, no conflict, 2fddf273', async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.file
    })

    let c2 = await user.mktreeAsync({
      type: 'nfs',
      drive: UUIDDE,
      dir: '',
      children: singletons.file
    })

    let importArgs = {
      type: 'import',
      src: {
        drive: UUIDDE,
        dir: 'src'
      },
      dst: {
        drive: user.home.uuid,
        dir: c1[0].xstat.uuid,
        name: c1[0].xstat.name
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(importArgs)
    assertTask(importArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length === 2)
    expect(next.step.nodes.find(n => !n.parent).state).to.equal('Parent')
    expect(next.step.nodes.find(n => n.src.name === 'foo').state).to.equal('Working')

    expect(next.watch.nodes.length === 0)
    expect(next.watch.finished).to.be.true
  })

  it('import, dir, no conflict, 9de7aeff', async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.dir
    })

    let c2 = await user.mktreeAsync({
      type: 'nfs',
      drive: UUIDDE,
      dir: '',
      children: singletons.dir
    })

    let importArgs = {
      type: 'import',
      src: {
        drive: UUIDDE,
        dir: 'src'
      },
      dst: {
        drive: user.home.uuid,
        dir: c1[0].xstat.uuid
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(importArgs)
    assertTask(importArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    // first step root @ Preparing
    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(2)
    expect(next.step.nodes[0].state).to.equal('Preparing')
    expect(next.step.nodes[1].state).to.equal('Parent')

    expect(next.watch.nodes).to.deep.equal([])
    expect(next.watch.finished).to.be.true
  })

  it('export, file, no conflict', async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.file
    })

    let c2 = await user.mktreeAsync({
      type: 'nfs',
      drive: UUIDDE,
      dir: '',
      children: singletons.file
    })

    let exportArgs = {
      type: 'export',
      src: {
        drive: user.home.uuid,
        dir: c1[1].xstat.uuid,
        name: c1[1].xstat.name
      },
      dst: {
        drive: UUIDDE,
        dir: 'dst'
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(exportArgs)
    assertTask(exportArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length === 2)
    expect(next.step.nodes.find(n => !n.parent).state).to.equal('Parent')
    expect(next.step.nodes.find(n => n.src.name === 'foo').state).to.equal('Working')

    expect(next.watch.nodes.length === 0)
    expect(next.watch.finished).to.be.true
  })

  it('export, dir, no conflict, 5653f29c', async function () {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: singletons.dir
    })

    let c2 = await user.mktreeAsync({
      type: 'nfs',
      drive: UUIDDE,
      dir: '',
      children: singletons.dir
    })

    let exportArgs = {
      type: 'export',
      src: {
        drive: user.home.uuid,
        dir: c1[1].xstat.uuid,
        name: c1[1].xstat.name
      },
      dst: {
        drive: UUIDDE,
        dir: 'dst'
      },
      entries: ['foo'],
      stepping: true
    }

    let task, next
    task = await user.createTaskAsync(exportArgs)
    assertTask(exportArgs, task)

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(1)
    expect(next.step.nodes[0].state).to.equal('Preparing')

    expect(next.watch.nodes.length).to.equal(1)
    expect(next.watch.nodes[0].state).to.equal('Parent')

    next = await user.stepTaskAsync(task.uuid)

    expect(next.step.nodes.length).to.equal(2)
    expect(next.step.nodes[0].state).to.equal('Preparing')
    expect(next.step.nodes[1].state).to.equal('Parent')

    expect(next.watch.nodes).to.deep.equal([])
    expect(next.watch.finished).to.be.true
  })
})
