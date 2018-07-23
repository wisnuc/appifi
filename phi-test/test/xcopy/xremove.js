const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const fakeNfsAsync = require('test/lib/nfs')
const { UUIDDE, UUIDF } = fakeNfsAsync

const Watson = require('phi-test/lib/watson')
const { sortF, getConflicts, shake, generate } = require('src/fruitmix/xcopy/xtree')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const FILES = require('../lib').FILES

const { alonzo, vpai001, foo } = FILES

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

describe(path.basename(__filename), () => {
  let watson, user, home, pub, n1, n2

  beforeEach(async function () {
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
      watson.login('alice', 'alice', err => err ? reject(err) : resolve()))

    fruitmix.nfs.update(fake.storage)
    user = watson.users.alice
  })

  it('should remove files in vfs', async function () {
    this.timeout(100000)

    let src = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: [
        {
          type: 'directory',
          name: 'foo',
          children: [
            {
              type: 'file',
              name: alonzo.name,
              file: alonzo.path,
              size: alonzo.size,
              sha256: alonzo.hash 
            },
            {
              type: 'file',
              name: vpai001.name,
              file: vpai001.path,
              size: vpai001.size,
              sha256: vpai001.hash 
            } 
          ]
        }
      ]
    }) 

    let xs = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get('/files')
        .set('Authorization', 'JWT ' + user.token) 
        .query({
          places: user.home.uuid,
          class: 'image'
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))
    }) 

    let task = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .post('/tasks')
        .set('Authorization', 'JWT ' + user.token) 
        .send({
          batch: true,
          type: 'remove',
          entries: xs.map(x => ({
            drive: user.home.uuid,
            dir: x.pdir,
            name: x.namepath.pop()
          }))
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))
  })

  it('should remove dirs & files in vfs, 4a0cb7de', async function () {
    this.timeout(100000)

    let src = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: [
        {
          type: 'directory',
          name: 'foo',
          children: [
            {
              type: 'file',
              name: 'foo1',
              file: alonzo.path,
              size: alonzo.size,
              sha256: alonzo.hash 
            },
            {
              type: 'file',
              name: 'foo2',
              file: vpai001.path,
              size: vpai001.size,
              sha256: vpai001.hash 
            } 
          ]
        }
      ]
    }) 

    let xs = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get('/files')
        .set('Authorization', 'JWT ' + user.token) 
        .query({
          order: 'find',
          places: user.home.uuid,
          name: 'foo'
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))
    }) 

    let entries = xs.map(x => ({
      drive: user.home.uuid,
      dir: x.pdir,
      name: x.namepath.pop()
    }))

    let task = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .post('/tasks')
        .set('Authorization', 'JWT ' + user.token) 
        .send({
          batch: true,
          type: 'remove',
          entries
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    await Promise.delay(200)
  })

  it('should remove files in nfs', async function () {
    this.timeout(100000)

    let src = await user.mktreeAsync({
      type: 'nfs',
      drive: UUIDDE,
      dir: '',
      children: [
        {
          type: 'directory',
          name: 'foo',
          children: [
            {
              type: 'file',
              name: 'file001',
              file: alonzo.path,
              size: alonzo.size,
              sha256: alonzo.hash 
            },
            {
              type: 'file',
              name: 'file002',
              file: vpai001.path,
              size: vpai001.size,
              sha256: vpai001.hash 
            } 
          ]
        }
      ]
    }) 

    let xs = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get(`/phy-drives/${UUIDDE}`)
        .set('Authorization', 'JWT ' + user.token) 
        .query({
          path: 'foo',
          name: 'file' 
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))
    }) 

    let task = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .post('/tasks')
        .set('Authorization', 'JWT ' + user.token) 
        .send({
          batch: true,
          type: 'nremove',
          entries: xs.map(x => {
            let ns = x.namepath
            let name = ns.pop()
            return {
              drive: UUIDDE,
              dir: path.join('foo', ...ns),
              name
            }
          })
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    await Promise.delay(200)
  })

  it('should remove dirs & files in nfs', async function () {
    this.timeout(100000)

    let src = await user.mktreeAsync({
      type: 'nfs',
      drive: UUIDDE,
      dir: '',
      children: [
        {
          type: 'directory',
          name: 'foo',
          children: [
            {
              type: 'file',
              name: 'foo1',
              file: alonzo.path,
              size: alonzo.size,
              sha256: alonzo.hash 
            },
            {
              type: 'file',
              name: 'foo2',
              file: vpai001.path,
              size: vpai001.size,
              sha256: vpai001.hash 
            } 
          ]
        }
      ]
    }) 

    let xs = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get(`/phy-drives/${UUIDDE}`)
        .set('Authorization', 'JWT ' + user.token) 
        .query({
          path: '',
          name: 'foo' 
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))
    }) 

    let entries = xs.map(x => {
      let ns = x.namepath
      let name = ns.pop()
      return {
        drive: UUIDDE,
        dir: ns.length === 0 ? '' : path.join(...ns),
        name
      }
    })

    let task = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .post('/tasks')
        .set('Authorization', 'JWT ' + user.token) 
        .send({
          batch: true,
          type: 'nremove',
          entries
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    await Promise.delay(200)
  })

})
