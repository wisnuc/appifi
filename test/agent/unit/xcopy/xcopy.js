const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const { isUUID } = require('validator')

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const fps = require('src/utils/fingerprintSimple')
const fakeNfsAsync = require('test/lib/nfs')

const { UUIDBC, UUIDDE } = fakeNfsAsync

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

const Mkpath = (root, relpath) => path.join(root, relpath)

const Mkdir = (root, relpath) => {
  let dirPath = path.join(root, relpath)
  mkdirp.sync(dirPath)
  expect(fs.lstatSync(dirPath).isDirectory()).to.be.true
  return dirPath
}

const Mkfile = (root, relpath, data) => {
  Mkdir(root, path.dirname(relpath))
  let filePath = path.join(root, relpath)
  fs.writeFileSync(filePath, data)
  expect(fs.lstatSync(filePath).isFile()).to.be.true
  return filePath
}

const Mklink = (root, relpath) => {
  Mkdir(root, path.dirname(relpath))
  let linkPath = path.join(root, relpath)
  fs.symlinkSync('/dev/null', linkPath)
  expect(fs.lstatSync(linkPath).isSymbolicLink()).to.be.true
  return linkPath
}

class User {
  constructor (ctx, username, password) {
    this.ctx = ctx
    this.username = username
    this.password = password
  }

  refreshToken (callback) {
    this.ctx.listBasicUsers((err, basicUsers) => {
      if (err) return callback(err)
      let me = basicUsers.find(u => u.username === this.username)
      if (!me) {
        let err = new Error('user not found')
        callback(err)
      } else {
        this.ctx.getToken(me.uuid, this.password, (err, token) => {
          if (err) return callback(err)
          this.uuid = me.uuid
          this.token = token
          callback(null, token)
        })
      }
    })
  }

  refreshDrives (callback) {
    this.ctx.getDrives(this.token, (err, drives) => {
      if (err) return callback(err)
      this.drives = drives
      this.home = this.drives.find(d => d.type === 'private' && d.tag === 'home')
      callback(null, drives)
    })
  }

  mkdir (_drive, _dir, name, callback) {
    let drive = _drive === 'home' ? this.home.uuid : _drive
    let dir = _dir || drive

    this.ctx.mkdir(this.token, drive, dir, name, callback)
  }

  async mktreeAsync (props) {
    return await this.ctx.mktreeAsync(Object.assign({ token: this.token }, props))
  }

  mktree (drive, dir, children, callback) {
    this.mktreeAsync(drive, dir, children)
      .then(() => callback())
      .catch(e => callback(e))
  }

  post (url) {
    return request(this.ctx.app.express)
      .post(url)
      .set('Authorization', 'JWT ' + this.token)
  }

  patch (url) {
    return request(this.ctx.app.express)
      .patch(url)
      .set('Authorization', 'JWT ' + this.token)
  }

  createTask (args, callback) {
    this.ctx.createTask(this.token, args, callback)
  }

  async createTaskAsync (args) {
    return Promise.promisify(this.createTask).bind(this)(args)
  }

  patchTask (taskUUID, nodeUUID, args, callback) {
    this.ctx.patchTask(this.token, taskUUID, nodeUUID, args, callback)
  }

  async patchTaskAsync (taskUUID, nodeUUID, args) {
    return Promise.promisify(this.patchTask).bind(this)(taskUUID, nodeUUID, args)
  }

  stepTask (taskUUID, callback) {
    this.ctx.stepTask(this.token, taskUUID, callback)
  }

  async stepTaskAsync (taskUUID) {
    return Promise.promisify(this.stepTask).bind(this)(taskUUID)
  }
}

class Watson {
  /**
  @param {object} opts
  @param {object} opts.app - app
  @param {object} opts.server - server ip address
  */
  constructor (opts) {
    if (opts.app) {
      this.app = opts.app
    } else {
      this.server = opts.server
    }

    this.users = {}
  }

  listBasicUsers (callback) {
    request(this.app.express)
      .get('/users')
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  getToken (userUUID, password, callback) {
    request(this.app.express)
      .get('/token')
      .auth(userUUID, password)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body.token))
  }

  getDrives (token, callback) {
    request(this.app.express)
      .get('/drives')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  login (username, password, callback) {
    let u = new User(this, username, password)
    u.refreshToken(err => {
      if (err) return callback(err)
      u.refreshDrives(err => {
        if (err) return callback(err)
        this.users[u.username] = u
        callback(null, u)
      })
    })
  }

  mkdir (token, driveUUID, dirUUID, name, callback) {
    request(this.app.express)
      .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field(name, JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null, res.body[0].data)
      })
  }

  nfsMkdir (token, driveId, dir, name, callback) {
    request(this.app.express)
      .post(`/phy-drives/${driveId}`)
      .set('Authorization', 'JWT ' + token)
      .query({ path: dir })
      .field('directory', name)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null)
      })
  }

  newfile (token, driveUUID, dirUUID, name, file, size, sha256, callback) {
    request(this.app.express)
      .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach(name, file, JSON.stringify({ op: 'newfile', size, sha256 }))
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null, res.body[0].data)
      })
  }

  nfsNewfile (token, driveId, dir, name, file, callback) {
    request(this.app.express)
      .post(`/phy-drives/${driveId}`)
      .set('Authorization', 'JWT ' + token)
      .query({ path: dir })
      .attach('file', file, name)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null)
      })
  }

  /**
  @param {string} parent - dir uuid for vfs, dir path for nfs
  */ 
  async visitNode (node, parent, af) {
    // vfs api returns xstat, nfs api returns nothing
    let xstat = await af(node, parent)
    if (xstat) Object.assign(node, { xstat })

    let children = node.children
    if (children) {
      for (let i = 0; i < children.length; i++) { 
        if (xstat) {
          await this.visitNode(children[i], xstat.uuid, af)
        } else {
          await this.visitNode(children[i], path.join(parent, node.name), af)
        }
      }
    }
  }

  async mktreeAsync (props) {

    let { token, type, drive, dir, children } = props
    let cs = JSON.parse(JSON.stringify(children))

    if (type === 'vfs') { 
      for (let i = 0; i < cs.length; i++) {
        await this.visitNode(cs[i], dir, async ({ type, name, file, size, sha256 }, dir) => 
          type === 'directory'
            ? new Promise((resolve, reject) => 
                this.mkdir(token, drive, dir, name, (err, xstat) => 
                  err ? reject(err) : resolve(xstat)))
            : new Promise((resolve, reject) => 
                this.newfile(token, drive, dir, name, file, size, sha256, (err, xstat) => 
                  err ? reject(err) : resolve(xstat))))
      }
    } else {
      for (let i = 0; i < cs.length; i++) {
        await this.visitNode(cs[i], dir, async ({ type, name, file, size, sha256 }, dir) =>
          type === 'directory'
            ? new Promise((resolve, reject) => 
                this.nfsMkdir(token, drive, dir, name, (err, stat) => 
                  err ? reject(err) : resolve()))
            : new Promise((resolve, reject) => 
                this.nfsNewfile(token, drive, dir, name, file, (err, stat) => 
                  err ? reject(err) : resolve())))
      }
    }

    return cs
  }

  xcopy (token, props, callback) {
    request(this.app.express)
      .post('/tasks')
      .send(props)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null, res.body)
      })
  }

  stepTask (token, taskUUID, callback) {
    request(this.app.express)
      .patch(`/tasks/${taskUUID}`)
      .set('Authorization', 'JWT ' + token)
      .send({ op: 'step' })
      .expect(200)
      .end((err, res) => {
        if (err) {
          console.log('ERROR', err, res.body)
          callback(err)
        } else {
          let step = res.body
          request(this.app.express)
            .patch(`/tasks/${taskUUID}`)
            .set('Authorization', 'JWT ' + token)
            .send({ op: 'watch' })
            .expect(200)
            .end((err, res) => {
              if (err) return callback(err)
              let watch = res.body
              callback(null, { step, watch })
            })
        }
      })
  }

  createTask (token, args, callback) {
    request(this.app.express)
      .post('/tasks')
      .set('Authorization', 'JWT ' + token)
      .send(args)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  patchTask (token, taskUUID, nodeUUID, args, callback) {
    request(this.app.express)
      .patch(`/tasks/${taskUUID}/nodes/${nodeUUID}`)
      .set('Authorization', 'JWT ' + token)
      .send(args)
      .expect(200)
      .end((err, res) => {
        if (err) {
          console.log('ERROR patchTask', err. res && res.body)
          callback(err)
        } else {
          let patch = res.body
          request(this.app.express)
            .patch(`/tasks/${taskUUID}`)
            .set('Authorization', 'JWT ' + token) 
            .send({ op: 'watch' })
            .expect(200)
            .end((err, res) => {
              if (err) return callback(err)
              let watch = res.body
              callback(null, { patch, watch })
            })
        }
      })
  }
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
    expect(task.finished).to.be.false
    expect(task.stepping).to.be.true
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
  ],
} 

describe('xcopy task', () => {

  let watson, user

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(fruitmixDir)
    fake = await fakeNfsAsync(tmptest)
    boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

    let userFile = path.join(fruitmixDir, 'users.json')
    await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

    let opts = { fruitmixDir, boundVolume }
    fruitmix = new Fruitmix(opts)
    app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
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
    expect(next.watch.finished).to.be.true 
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
    expect(next.watch.finished).to.be.true

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
    expect(next.watch.finished).to.be.true

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
        dir: c1[1].xstat.uuid, 
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
        dir: c1[1].xstat.uuid, 
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
        name: c1[0].xstat.name,
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
