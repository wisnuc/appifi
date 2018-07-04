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
const { generate } = require('src/fruitmix/xcopy/xtree')


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

const clone = x => JSON.parse(JSON.stringify(x))

describe(path.basename(__filename), () => {
  describe('no conflict, single file copy', () => {
    let watson, user, home, pub, n1, n2

    // create tree before test
    const prepareTree = async _t => {
      let t = clone(_t)
      t.dir = t.dir.length === 0 
        ? t.type === 'vfs' ? t.drive : ''
        : await user.mkpathAsync({
            type: t.type,
            drive: t.drive,
            dir: t.type === 'vfs' ? t.drive : '',
            namepath: t.dir 
          })

      if (t.children.length) await user.mktreeAsync(t)
      return t
    }

    // strip off props for each node
    const strip = (t, props) => {
      props.forEach(p => { delete t[p] })
      if (t.children) t.children.forEach(c => strip(c, props))
      return t
    }

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

    it('copy single dir', async function () {
      let testdata = {
        src: {
          type: 'vfs',
          drive: user.home.uuid,
          dir: [],
          children: [
            {
              type: 'directory',
              name: 'foo'
            }
          ] 
        },
        dst: {
          type: 'vfs',
          drive: user.pub.uuid, 
          dir: ['bar'],
          children: [
          ]
        },
      }

      let src = await prepareTree(testdata.src) 
      let dst = await prepareTree(testdata.dst)

      let arg = {
        st: { type: 'directory', name: '', children: src.children },
        dt: { type: 'directory', name: '', children: dst.children }
      } 

      let stages = generate(arg)[0]
       
      let targ = {
        type: 'copy',
        src: { drive: src.drive, dir: src.dir },
        dst: { drive: dst.drive, dir: dst.dir },
        entries: src.children.map(c => c.name)
      }

      let task = await user.createTaskAsync(targ)
      await user.watchTaskAsync(task.uuid)

      let stree = { type: 'directory', name: '', children: await user.treeAsync(src) }
      let sstree = strip(clone(stree), ['uuid', 'mtime'])
      expect(sstree).to.deep.equal(strip(clone(stages[0].st), ['path', 'status']))

      let dtree = { type: 'directory', name: '', children: await user.treeAsync(dst) }
      let sdtree = strip(clone(stree), ['uuid', 'mtime'])
      expect(sdtree).to.deep.equal(strip(clone(stages[0].dt), ['path', 'status']))


    })

  })
})

