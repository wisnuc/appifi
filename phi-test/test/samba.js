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

const FILES = require('./lib').FILES
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
  phicommUserId: 'alice',
  phoneNumber: '15615615656'
}

const { UUIDDE } = fakeNfsAsync

describe(path.basename(__filename), () => {
  let watson, user, fake

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(fruitmixDir)
    fake = await fakeNfsAsync(tmptest)
    let boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

    let userFile = path.join(fruitmixDir, 'users.json')
    await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

    let fruitmix = new Fruitmix({ fruitmixDir, boundVolume, useSmb: true })
    let app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
    await new Promise(res => fruitmix.once('FruitmixStarted', () => res()))

    watson = new Watson({ app })
    await new Promise((res, rej) => watson.login('alice', 'alice', err => err ? rej(err) : res()))

    fruitmix.nfs.update(fake.storage)
    user = watson.users.alice
  })

  it('usb plug and unplug, nfs event', async function () {
    this.timeout(10000)

    let fruitmix = watson.app.fruitmix
    let nfs = fruitmix.nfs

    let s1 = JSON.parse(JSON.stringify(fake.storage))
    s1.blocks.filter(x => x.name.startsWith('sdi'))
      .forEach(x => {
        delete x.isATA
        x.idBus = 'usb'
        x.isUSB = true
      })

    let s2 = JSON.parse(JSON.stringify(fake.storage))
    s2.blocks = s2.blocks.filter(x => !x.name.startsWith('sdi'))

    let usb = await new Promise((resolve, reject) => {
      nfs.once('usb', x => resolve(x))
      process.nextTick(() => fruitmix.setStorage(s1))
    })

    expect(usb).to.deep.equal([
      { 
        name: 'i1',
        mountpoint: '/home/wisnuc/appifi/tmptest/sdi1',
        readOnly: false 
      },
      { 
        name: 'i2',
        mountpoint: '/home/wisnuc/appifi/tmptest/sdi2',
        readOnly: false 
      },
      { 
        name: 'i3',
        mountpoint: '/home/wisnuc/appifi/tmptest/sdi3',
        readOnly: false 
      },
      { 
        name: 'i5',
        mountpoint: '/home/wisnuc/appifi/tmptest/sdi5',
        readOnly: false 
      },
      { 
        name: 'i6',
        mountpoint: '/home/wisnuc/appifi/tmptest/sdi6',
        readOnly: false 
      },
      { 
        name: 'i7',
        mountpoint: '/home/wisnuc/appifi/tmptest/sdi7',
        readOnly: false 
      }
    ])

    usb = await new Promise((resolve, reject) => {
      nfs.once('usb', x => resolve(x))
      process.nextTick(() => fruitmix.setStorage(s2))
    })

    expect(usb).to.deep.equal([])
  })

  it('hello', async function () {
    this.timeout(0) 

    await new Promise((resolve, reject) => {
      request(watson.app.express)
        .patch(`/drives/${user.home.uuid}`)
        .set('Authorization', 'JWT ' + user.token)
        .send({ smb: false })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))
    })

    let drives = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get('/drives')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))
    })

    console.log('drives', drives)

    await Promise.delay(10000)
  })  
})
