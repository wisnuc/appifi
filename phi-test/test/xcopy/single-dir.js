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

const { UUIDDE, UUIDF } = fakeNfsAsync

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

    it('copy', async function () {
      let srcDirUUID = home.find(x => x.name === 'src').xstat.uuid
      let dstDirUUID = home.find(x => x.name === 'dst').xstat.uuid
      let args = {
        type: 'copy',
        src: { drive: user.home.uuid, dir: srcDirUUID },
        dst: { drive: user.home.uuid, dir: dstDirUUID },
        entries: ['foo'],
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listDirAsync(user.home.uuid, srcDirUUID)
      let dst = await user.listDirAsync(user.home.uuid, dstDirUUID)

      expect(src.entries[0].name).to.equal('foo')
      expect(dst.entries[0].name).to.equal('foo')
    })

    it('move', async function () {
      let srcDirUUID = home.find(x => x.name === 'src').xstat.uuid
      let dstDirUUID = home.find(x => x.name === 'dst').xstat.uuid

      let args = {
        type: 'move',
        src: { drive: user.home.uuid, dir: srcDirUUID },
        dst: { drive: user.home.uuid, dir: dstDirUUID },
        entries: ['foo'],
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listDirAsync(user.home.uuid, srcDirUUID)
      let dst = await user.listDirAsync(user.home.uuid, dstDirUUID)

      expect(src.entries.length).to.equal(0)
      expect(dst.entries[0].name).to.equal('foo')
    })

    it('icopy', async function () {
      let srcDirPath = 'src'
      let dstDirUUID = home.find(x => x.name === 'dst').xstat.uuid

      let args = {
        type: 'icopy',
        src: { drive: UUIDDE, dir: srcDirPath },
        dst: { drive: user.home.uuid, dir: dstDirUUID },
        entries: ['foo']
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listNfsDirAsync(UUIDDE, srcDirPath)
      let dst = await user.listDirAsync(user.home.uuid, dstDirUUID)

      expect(src[0].name).to.equal('foo') 
      expect(dst.entries[0].name).to.equal('foo')
    })

    it('imove', async function () {
      let srcDirPath = 'src'
      let dstDirUUID = home.find(x => x.name === 'dst').xstat.uuid

      let args = {
        type: 'imove',
        src: { drive: UUIDDE, dir: srcDirPath },
        dst: { drive: user.home.uuid, dir: dstDirUUID },
        entries: ['foo']
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listNfsDirAsync(UUIDDE, srcDirPath)
      let dst = await user.listDirAsync(user.home.uuid, dstDirUUID)

      expect(src.length).to.equal(0)
      expect(dst.entries[0].name).to.equal('foo')
    })

    it('ecopy', async function () {
      let srcDirUUID = home.find(x => x.name === 'src').xstat.uuid
      let dstDirPath = 'dst'

      let args = {
        type: 'ecopy',
        src: { drive: user.home.uuid, dir: srcDirUUID },
        dst: { drive: UUIDDE, dir: dstDirPath },
        entries: ['foo']
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listDirAsync(user.home.uuid, srcDirUUID)
      let dst = await user.listNfsDirAsync(UUIDDE, dstDirPath)

      expect(src.entries[0].name).to.equal('foo')
      expect(dst[0].name).to.equal('foo')
    })

    it('emove', async function () {
      let srcDirUUID = home.find(x => x.name === 'src').xstat.uuid
      let dstDirPath = 'dst'

      let args = {
        type: 'emove',
        src: { drive: user.home.uuid, dir: srcDirUUID },
        dst: { drive: UUIDDE, dir: dstDirPath },
        entries: ['foo']
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listDirAsync(user.home.uuid, srcDirUUID)
      let dst = await user.listNfsDirAsync(UUIDDE, dstDirPath)

      expect(src.entries.length).to.equal(0)
      expect(dst[0].name).to.equal('foo')
    })

    it('ncopy', async function () {
      let args = {
        type: 'ncopy',
        src: { drive: UUIDDE, dir: 'src' },
        dst: { drive: UUIDF, dir: 'dst' },
        entries: ['foo'],
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listNfsDirAsync(UUIDDE, 'src')
      let dst = await user.listNfsDirAsync(UUIDF, 'dst')

      expect(src[0].name).to.equal('foo')
      expect(dst[0].name).to.equal('foo')
    })

    it('nmove, diff drive', async function () {
      let args = {
        type: 'nmove',
        src: { drive: UUIDDE, dir: 'src' },
        dst: { drive: UUIDF, dir: 'dst' },
        entries: ['foo'],
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listNfsDirAsync(UUIDDE, 'src')
      let dst = await user.listNfsDirAsync(UUIDF, 'dst')

      expect(src.length).to.equal(0)
      expect(dst[0].name).to.equal('foo')
    })

    it('nmove, same drive', async function () {
      let args = {
        type: 'nmove',
        src: { drive: UUIDDE, dir: 'src' },
        dst: { drive: UUIDDE, dir: 'dst' },
        entries: ['foo']
      }

      let task = await user.createTaskAsync(args)
      await Promise.delay(500)

      let src = await user.listNfsDirAsync(UUIDDE, 'src')
      let dst = await user.listNfsDirAsync(UUIDDE, 'dst')

      expect(src.length).to.equal(0)
      expect(dst[0].name).to.equal('foo')
    })
  })
})
