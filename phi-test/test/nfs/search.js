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

const FILES = require('../lib').FILES
const { alonzo, hello, pdf } = FILES
const fakeNfsAsync = require('test/lib/nfs')

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')
const Watson = require('phi-test/lib/watson')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')
// node src/utils/md4Encrypt.js alice

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

const { UUIDDE } = fakeNfsAsync

describe(path.basename(__filename), () => {

  describe('d1/d2/d3', () => {
    let watson, user

    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      let fake = await fakeNfsAsync(tmptest)
      let boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      let fruitmix = new Fruitmix({ fruitmixDir, boundVolume })
      let app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(res => fruitmix.once('FruitmixStarted', () => res()))

      watson = new Watson({ app }) 
      await new Promise((res, rej) => watson.login('alice', 'alice', err => err ? rej(err) : res()))

      fruitmix.nfs.update(fake.storage)
      user = watson.users.alice
    })

    it('hello', async () => {
      let tree = await user.mktreeAsync({
        type: 'nfs',
        drive: UUIDDE,
        dir: '',
        children: [{
          type: 'directory',
          name: 'd1',
          children: [{
            type: 'directory',
            name: 'd2',
            children: [{ 
              type: 'directory', 
              name: 'd3' 
            }]
          }] 
        }]
      })

      let result = await new Promise((resolve, reject) => {
        request(watson.app.express)
          .get(`/phy-drives/${UUIDDE}`)
          .set('Authorization', 'JWT ' + user.token)
          .query({
            path: '',
            name: 'd',
            last: 'directory.d2'
          })
          .expect(200)
          .end((err, res) => err ? reject(err) : resolve(res.body))
      })

      console.log(result)
    })
  })
})
