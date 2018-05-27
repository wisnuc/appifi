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

  async mktreeAsync (drive, dir, children) {
    await this.ctx.mktreeAsync(this.token, drive, dir, children)
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

  // previsit
  async visitNode (node, parent, af) {
    let xstat = await af(node, parent)
    Object.assign(node, { xstat })

    let children = node.children
    if (children) {
      for (let i = 0; i < children.length; i++) { await this.visitNode(children[i], xstat.uuid, af) }
    }
  }

  async mktreeAsync (token, drive, dir, children) {
    for (let i = 0; i < children.length; i++) {
      await this.visitNode(children[i], dir, async ({ type, name, file, size, sha256}, dir) =>
        type === 'directory'
          ? new Promise((resolve, reject) =>
            this.mkdir(token, drive, dir, name, (err, xstat) =>
              err ? reject(err) : resolve(xstat)))
          : new Promise((resolve, reject) =>
            this.newfile(token, drive, dir, name, file, size, sha256, (err, xstat) =>
              err ? reject(err) : resolve(xstat))))
    }
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

  stepTask(token, taskUUID, callback) {
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

  createTask(token, args, callback) {
    request(this.app.express)
      .post('/tasks')
      .set('Authorization', 'JWT ' + token)
      .send(args)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }
}

describe('xcopy task', () => {
  let watson

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
  })

  it.skip('do something', function (done) {
    this.timeout(10000)

    let alice = watson.users.alice
    let alonzo = FILES.alonzo
    let children = [
      {
        type: 'directory',
        name: 'hello'
      },
      {
        type: 'directory',
        name: 'world',
        children: [
          {
            type: 'directory',
            name: 'foo'
          },
          {
            type: 'file',
            name: 'bar',
            file: alonzo.path,
            size: alonzo.size,
            sha256: alonzo.hash
          }
        ]
      }
    ]

    alice.mktree(alice.home.uuid, alice.home.uuid, children, err => {
      if (err) return done(err)

      let args = {
        type: 'copy',
        src: {
          drive: alice.home.uuid,
          dir: children[1].xstat.uuid
        },
        dst: {
          drive: alice.home.uuid,
          dir: children[0].xstat.uuid
        },
        entries: ['foo'],
        stepping: true
      }


      alice.post('/tasks')
        .send(args)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let task = res.body
          expect(task.stepping).to.be.true
          expect(task.steppingState).to.equal('Stopped')

          alice.stepTask(task.uuid, (err, rs) => {
            if (err) return done(err)
            let { step, watch } = rs
            console.log(step, watch)
            done()
          })
        })
    })
  })

  it('do something else', async function () {
    this.timeout(10000)

    let alice = watson.users.alice
    let alonzo = FILES.alonzo
    let children = [
      { type: 'directory', name: 'hello' },
      { type: 'directory', name: 'world',
        children: [
          {
            type: 'directory',
            name: 'foo',
            children: [
              { type: 'directory', name: 'dir0' },
              { type: 'directory', name: 'dir1' },
              { type: 'directory', name: 'dir2' },
              { type: 'directory', name: 'dir3' },
              { type: 'directory', name: 'dir4' },
              { type: 'directory', name: 'dir5' },
              { type: 'directory', name: 'dir6' },
              { type: 'directory', name: 'dir7' },
            ]
          },
          { type: 'file', name: 'bar0', file: alonzo.path, size: alonzo.size, sha256: alonzo.hash },
          { type: 'file', name: 'bar1', file: alonzo.path, size: alonzo.size, sha256: alonzo.hash },
          { type: 'file', name: 'bar2', file: alonzo.path, size: alonzo.size, sha256: alonzo.hash },
          { type: 'file', name: 'bar3', file: alonzo.path, size: alonzo.size, sha256: alonzo.hash },
          { type: 'file', name: 'bar4', file: alonzo.path, size: alonzo.size, sha256: alonzo.hash },
          { type: 'file', name: 'bar5', file: alonzo.path, size: alonzo.size, sha256: alonzo.hash },
          { type: 'file', name: 'bar6', file: alonzo.path, size: alonzo.size, sha256: alonzo.hash },
          { type: 'file', name: 'bar7', file: alonzo.path, size: alonzo.size, sha256: alonzo.hash },
        ]
      }
    ]

    await alice.mktreeAsync(alice.home.uuid, alice.home.uuid, children)

    let args = {
      type: 'copy',
      src: {
        drive: alice.home.uuid,
        dir: children[1].xstat.uuid
      },
      dst: {
        drive: alice.home.uuid,
        dir: children[0].xstat.uuid
      },
      entries: ['foo', 'bar0', 'bar1', 'bar2', 'bar3', 'bar4', 'bar5', 'bar6', 'bar7'],
      stepping: true
    }

    let task, next
    task = await alice.createTaskAsync(args)
    console.log(':: task ::', task)
 
    do { 
      next = await alice.stepTaskAsync(task.uuid)
      console.log(':: next ::', JSON.stringify(next, null, '  '))
    } while (!next.watch.finished)
    
  })
})
