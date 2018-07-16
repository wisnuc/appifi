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

const fileMeta = require('src/lib/file-meta')

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const fakeNfsAsync = require('test/lib/nfs')

const Watson = require('phi-test/lib/watson')

const { UUIDDE } = fakeNfsAsync

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const FILES = require('../lib').FILES

const { alonzo, foo, wmvSample, wmaSample } = FILES

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

  it("wma", async function () {
    this.timeout(0)
    let c = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: [
        {
          type: 'file',
          name: wmaSample.name,
          file: wmaSample.path,
          size: wmaSample.size,
          sha256: wmaSample.hash
        }
      ]
    })

    let x = await new Promise((resolve, reject) => 
      request(watson.app.express) 
        .get(`/drives/${user.home.uuid}/dirs/${user.home.uuid}`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)    
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(x.entries[0].metadata.type).to.equal('WMA')
  }) 

  it("wmv", async function () {
    this.timeout(0)
    let c = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: [
        {
          type: 'file',
          name: wmvSample.name,
          file: wmvSample.path,
          size: wmvSample.size,
          sha256: wmvSample.hash
        }
      ]
    })

    let x = await new Promise((resolve, reject) => 
      request(watson.app.express) 
        .get(`/drives/${user.home.uuid}/dirs/${user.home.uuid}`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)    
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(x.entries[0].metadata.type).to.equal('WMV')
  }) 
})
