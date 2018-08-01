const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
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

const Alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'alice',
  phoneNumber: '13900000001'
}

const Bob = {
  uuid: '620970c1-589a-4ed5-b94c-838b2b498583',
  username: 'bob',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'bob',
  phoneNumber: '13900000002'
}

const Charlie = {
  uuid: '1b5f9a45-a2c6-40c4-821c-7c7fcf02df84',
  username: 'charlie',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'charlie',
  phoneNumber: '13900000003'
}

// david has no smb password
const David = {
  uuid: 'ff038083-fb42-4f50-aa6f-b3aabe29b3c7',
  username: 'david',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'david',
  phoneNumber: '13900000004'
}

// eve has no smb password
const Eve = {
  uuid: '2183dd24-3124-4468-9d73-7787c61c1b76',
  username: 'eve',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'eve',
  phoneNumber: '13900000005'
}

const Frank = {
  uuid: '1f04fc16-8299-4449-93a2-1cb17eb5e004',
  username: 'frank',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'frank',
  phoneNumber: '13900000006'
}

const Grace = {
  uuid: '74d9fd2d-a371-4f66-b3cd-06322d8a488d',
  username: 'grace',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'grace',
  phoneNumber: '13900000007'
}


/**
620970c1-589a-4ed5-b94c-838b2b498583
8b42b093-53ea-4291-8f9b-03b2f6241dd5
8be29fc8-5f2a-4523-bdde-1148919f49f4
6a0fbefe-f935-4e2d-b1eb-bb434a75dfc7
92b3aa91-e486-4d87-b2ce-f7a15fbc329b
*/


const { UUIDDE } = fakeNfsAsync

const browse = callback => child.exec('smbclient -gNL localhost', (err, stdout, stderr) => {
  if (err) {
    callback(err)
  } else {
    let xs = stdout.split('\n')
      .map(x => x.trim())
      .filter(x => !!x)
      .map(x => x.split('|').filter(x => !!x))
      .filter(x => x[0] === 'Disk')
      .map(x => x[1])

    callback(null, xs)
  }
})

const browseAsync = Promise.promisify(browse)

describe(path.basename(__filename), () => {

  let watson, alice, fake

  const prepareAsync = async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(fruitmixDir)
    fake = await fakeNfsAsync(tmptest)
    let boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

    let userFile = path.join(fruitmixDir, 'users.json')
    await fs.writeFileAsync(userFile, JSON.stringify([Alice, Bob, Charlie, David, Eve, Frank, Grace], null, '  '))

    let fruitmix = new Fruitmix({ fruitmixDir, boundVolume, useSmb: true })
    let app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
    await new Promise(res => fruitmix.once('FruitmixStarted', () => res()))

    watson = new Watson({ app })
    await new Promise((res, rej) => watson.login('alice', 'alice', err => err ? rej(err) : res()))

    fruitmix.nfs.update(fake.storage)
    alice = watson.users.alice
  }

  it('from alice to grace', async function () {
    this.timeout(0)

    let stdout, body, shares

    // first disable samba
    await fs.writeFileAsync('/etc/samba/smb.conf', '\n')
    await child.execAsync('systemctl stop smbd')
    await child.execAsync('systemctl disable smbd')
    await Promise.delay(1000)

    stdout = await new Promise((resolve, reject) => {
      child.exec('systemctl is-active smbd', (err, stdout, stderr) => {
        if (err &&
          err.killed === false &&
          err.code === 3 &&
          err.signal === null &&
          stdout.trim() === 'inactive') {
          resolve(stdout)
        } else if (err) {
          reject(err)
        } else {
          reject(new Error(stdout.trim()))
        }
      })
    })
   
    expect(stdout.trim()).to.equal('inactive') 

    stdout = await new Promise((resolve, reject) => {
      child.exec('systemctl is-enabled smbd', (err, stdout, stderr) => {
        if (err &&
          err.killed === false &&
          err.code === 1 &&
          err.signal === null &&
          stdout.trim() === 'disabled') {
          resolve(stdout)
        } else if (err) {
          reject(err)
        } else {
          reject(new Error(stdout.trim()))
        }
      })
    })

    expect(stdout.trim()).to.equal('disabled')

    await rimrafAsync(tmptest)
    await mkdirpAsync(fruitmixDir)
    fake = await fakeNfsAsync(tmptest)
    let boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

    let userFile = path.join(fruitmixDir, 'users.json')
    let userData = [Alice, Bob, Charlie, David, Eve, Frank, Grace]
    await fs.writeFileAsync(userFile, JSON.stringify(userData, null, '  '))

    let fruitmix = new Fruitmix({ fruitmixDir, boundVolume, useSmb: true })
    let app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
    await new Promise(res => fruitmix.once('FruitmixStarted', () => res()))

    fruitmix.nfs.update(fake.storage)

    watson = new Watson({ app })

    await new Promise((resolve, reject) => 
      watson.login('alice', 'alice', err => err ? reject(err) : resolve()))

    alice = watson.users.alice

    // create foo
    let foo = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .post('/drives')
        .set('Authorization', 'JWT ' + alice.token)
        .send({
          writelist: [
            Bob.uuid,
            Charlie.uuid,
            David.uuid,
            Eve.uuid,
            Frank.uuid,
            Grace.uuid
          ],
          label: 'foo' 
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))) 

    // delete foo
    await new Promise((resolve, reject) => 
      request(watson.app.express)
        .delete(`/drives/${foo.uuid}`)
        .set('Authorization', 'JWT ' + alice.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // create hello
    let hello = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .post('/drives')
        .set('Authorization', 'JWT ' + alice.token)
        .send({
          writelist: [
            Bob.uuid,
            David.uuid,
            Eve.uuid,
            Frank.uuid,
            Grace.uuid
          ],
          label: 'hello' 
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))) 

    // create world
    let world = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .post('/drives')
        .set('Authorization', 'JWT ' + alice.token)
        .send({
          writelist: [
            Charlie.uuid,
            David.uuid,
            Eve.uuid,
            Frank.uuid,
            Grace.uuid
          ],
          label: 'world' 
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body))) 

    for (let i = 1; i < userData.length; i++) {
      await new Promise((resolve, reject) => 
        watson.login(userData[i].username, 'alice', err => err ? reject(err) : resolve()))
    }

    let { bob, charlie, david, eve, frank, grace } = watson.users

    // charlie turns off smb 
    await new Promise((resolve, reject) => 
      request(watson.app.express)
        .patch(`/drives/${charlie.home.uuid}`)
        .set('Authorization', 'JWT ' + charlie.token)
        .send({ smb: false })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // eve turns off smb
    await new Promise((resolve, reject) => 
      request(watson.app.express)
        .patch(`/drives/${eve.home.uuid}`)
        .set('Authorization', 'JWT ' + eve.token)
        .send({ smb: false })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // deactivate frank
    await new Promise((resolve, reject) =>
      request(watson.app.express)
        .patch(`/users/${Frank.uuid}`)
        .set('Authorization', 'JWT ' + alice.token)
        .send({ status: 'INACTIVE' })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // delete grace
    await new Promise((resolve, reject) => 
      request(watson.app.express)
        .delete(`/users/${Grace.uuid}`)
        .set('Authorization', 'JWT ' + alice.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // start samba
    await new Promise((resolve, reject) => 
      request(watson.app.express)
        .patch('/samba')
        .set('Authorization', 'JWT ' + alice.token)
        .send({ op: 'start' })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    await Promise.delay(3000)

    let list = await browseAsync()  
    console.log(list.sort())

    expect(list).to.deep.equal([
      Alice.phoneNumber,
      Bob.phoneNumber,
      Charlie.phoneNumber,
      Eve.phoneNumber,
      '默认共享盘',
      'hello',
      'world'
    ].sort())
  })
})
