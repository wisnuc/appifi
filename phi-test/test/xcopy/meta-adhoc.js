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
const { UUIDDE, UUIDF } = fakeNfsAsync

const Watson = require('phi-test/lib/watson')
const { copy, expand } = require('src/fruitmix/xtree/expand')

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

describe(path.basename(__filename), () => {
  describe('no conflict', () => {
    let watson, user, home, pub, n1, n2

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

      let children = [
        { type: 'directory', name: 'dst' },
        { type: 'directory',
          name: 'src',
          children: [
            {
              type: 'directory',
              name: 'foo',
            }
          ]
        }
      ] 

      home = await user.mktreeAsync({
        type: 'vfs',
        drive: user.home.uuid,
        dir: user.home.uuid,
        children
      })

      pub = await user.mktreeAsync({
        type: 'vfs',
        drive: user.pub.uuid,
        dir: user.pub.uuid,
        children 
      })

      n1 = await user.mktreeAsync({
        type: 'nfs',
        drive: UUIDDE,
        dir: '',
        children
      })

      n2 = await user.mktreeAsync({
        type: 'nfs',
        drive: UUIDF,
        dir: '',
        children
      })
    })
  
    it('copy single dir', async function () {

      let root = {
        st: {
          type: 'directory',
          name: '',
          children: [
            {
              type: 'directory',
              name: 'foo',
              children: []
            }
          ]   
        },
        dt: {
          type: 'directory',
          name: '',
          children: []
        }
        
      } 

      let xtree = copy(root)

      console.log('======')
      console.log(JSON.stringify(xtree, null, '  '))
      console.log('======')

      let groot = { xtree }

      expand(groot)
        
      console.log(groot)
    })

  })
})

