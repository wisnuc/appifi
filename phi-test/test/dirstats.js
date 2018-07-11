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

const Watson = require('phi-test/lib/watson')

const { UUIDDE } = fakeNfsAsync

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const FILES = require('./lib').FILES

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

describe(path.basename(__filename), () => {
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

  it('empty foo', async function () {
    let t = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: [
        {
          type: 'directory',
          name: 'foo',
          children: [
            {
              type: 'directory',
              name: 'hello',
              children: [
                {
                  type: 'directory',
                  name: 'slash'
                },
                {
                  type: 'file',
                  name: 'dot',
                  file: alonzo.path,
                  size: alonzo.size,
                  sha256: alonzo.hash
                }
              ]
            },
            {
              type: 'file',
              name: 'world',
              file: alonzo.path,
              size: alonzo.size,
              sha256: alonzo.hash
            }
          ]
        },
        { 
          type: 'file',
          name: 'bar',
          file: alonzo.path,
          size: alonzo.size,
          sha256: alonzo.hash
        }
      ] 
    })

    let stats = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get(`/drives/${user.home.uuid}/dirs/${user.home.uuid}/stats`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(stats).to.deep.equal({
      dirCount: 3,
      fileCount: 3,
      fileTotalSize: alonzo.size * 3
    })

    let foo = t.find(x => x.name === 'foo')
    stats = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get(`/drives/${user.home.uuid}/dirs/${foo.xstat.uuid}/stats`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(stats).to.deep.equal({
      dirCount: 2,
      fileCount: 2,
      fileTotalSize: alonzo.size * 2
    })

    let hello = foo.children.find(x => x.name === 'hello')
    stats = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get(`/drives/${user.home.uuid}/dirs/${hello.xstat.uuid}/stats`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(stats).to.deep.equal({
      dirCount: 1,
      fileCount: 1,
      fileTotalSize: alonzo.size
    })

    let slash = hello.children.find(x => x.name === 'slash')
    stats = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get(`/drives/${user.home.uuid}/dirs/${slash.xstat.uuid}/stats`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(stats).to.deep.equal({
      dirCount: 0,
      fileCount: 0,
      fileTotalSize: 0
    })
  })
})


