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

describe('stats', () => {
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

  it('ad hoc', async () => {
    let c1 = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: [
        {
          type: 'file',
          name: alonzo.name,
          file: alonzo.path,
          size: alonzo.size,
          sha256: alonzo.hash
        }
      ]
    })

    let stats = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get('/fruitmix/stats')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => {
          if (err) {
            reject(err)
          } else {
            resolve(res.body)
          }
        })
    })

    expect(stats).to.deep.equal({ 
      image: { count: 1, totalSize: 39499 },
      video: { count: 0, totalSize: 0 },
      audio: { count: 0, totalSize: 0 },
      document: { count: 0, totalSize: 0 } 
    })
  })
})
