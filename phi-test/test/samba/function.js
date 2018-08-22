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
  smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
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
  smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
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
  smbPassword: '2FAF5F4A6E588F18F1F84616DA5BA9A7',
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
  smbPassword: 'E7DEF634283A9C5823D8BDF1C0D5D65E',
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

const access = (name, user, pass, callback) =>
  child.exec(`smbclient -U ${user} \\\\\\\\localhost\\\\${name} ${pass} -c ls`, (err, stdout, stderr) => 
    callback(null, { err, stdout, stderr }))

const accessAsync = Promise.promisify(access)

const nopass = (name, callback) => child.exec(`smbclient -N \\\\\\\\localhost\\\\${name} -c ls`, callback)

const nopassAsync = Promise.promisify(nopass)


describe(path.basename(__filename), () => {

  let watson, alice, fake

  const prepareAsync = async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(fruitmixDir)
    fake = await fakeNfsAsync(tmptest)
    let boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

    let userFile = path.join(fruitmixDir, 'users.json')
    await fs.writeFileAsync(userFile, 
      JSON.stringify([Alice, Bob, Charlie, David, Eve, Frank, Grace], null, '  '))

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

    expect(list.sort()).to.deep.equal([
      Alice.phoneNumber,
      Bob.phoneNumber,
      Charlie.phoneNumber,
      Eve.phoneNumber,
      '默认共享盘',
      'hello',
      'world'
    ].sort())

    // everybody can access charlie's and eve's drive, as well as built-in
    
    await nopassAsync(Charlie.phoneNumber) 
    await nopassAsync(Eve.phoneNumber)
    await nopassAsync('默认共享盘')

    let r

    // alice can access her drive
    r = await accessAsync(Alice.phoneNumber, Alice.phoneNumber, 'alice')
    expect(r.err).to.equal(null)

    // bob cannot access alice's drive
    r = await accessAsync(Alice.phoneNumber, Bob.phoneNumber, 'bob')
    expect(r.err).to.be.an('error')
    expect(r.stdout).to.includes('NT_STATUS_ACCESS_DENIED')

    // bob can access his drive
    r = await accessAsync(Bob.phoneNumber, Bob.phoneNumber, 'bob')
    expect(r.err).to.equal(null)
    
    // alice cannot access bob's drive
    r = await accessAsync(Bob.phoneNumber, Alice.phoneNumber, 'alice')
    expect(r.err).to.be.an('error')
    expect(r.stdout).to.includes('NT_STATUS_ACCESS_DENIED')

    // alice and bob can access hello, but not charlie, david, eve, frank, grace
    r = await accessAsync('hello', Alice.phoneNumber, 'alice')
    expect(r.err).to.equal(null)

    r = await accessAsync('hello', Bob.phoneNumber, 'bob')
    expect(r.err).to.equal(null)

    r = await accessAsync('hello', Charlie.phoneNumber, 'charlie')
    expect(r.err).to.be.an('error')
    expect(r.stdout).to.includes('NT_STATUS_ACCESS_DENIED')

    r = await accessAsync('hello', Frank.phoneNumber, 'frank')
    expect(r.err).to.be.an('error')
    expect(r.stdout).to.includes('NT_STATUS_ACCESS_DENIED')

    r = await accessAsync('hello', Grace.phoneNumber, 'grace')
    expect(r.err).to.be.an('error')
    expect(r.stdout).to.includes('NT_STATUS_ACCESS_DENIED')


    // alice and charlie can access world, but not bob
    r = await accessAsync('world', Alice.phoneNumber, 'alice')
    expect(r.err).to.equal(null)

    r = await accessAsync('world', Charlie.phoneNumber, 'charlie')
    expect(r.err).to.equal(null)

    r = await accessAsync('world', Bob.phoneNumber, 'bob')
    expect(r.err).to.be.an('error')
    expect(r.stdout).to.includes('NT_STATUS_ACCESS_DENIED')

    r = await accessAsync('hello', Frank.phoneNumber, 'frank')
    expect(r.err).to.be.an('error')
    expect(r.stdout).to.includes('NT_STATUS_ACCESS_DENIED')

    r = await accessAsync('hello', Grace.phoneNumber, 'grace')
    expect(r.err).to.be.an('error')
    expect(r.stdout).to.includes('NT_STATUS_ACCESS_DENIED')

  })

  /**
  NAS-329 & NAS-330 deleted share should not be seen from smbclient, 
  this is asserted by drive foo in above tests.

  NAS-332 & NAS-367 user change smb password, it should take effect. This requires one test case.
  
  NAS-371 misunderstanding on PFL

  NAS-373 start samba should return success if already started
  */


  it('alice changes her samba password and new password should take effect, 1b8c34de', async function () {
    this.timeout(0)  

    let stdout, body, shares

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
    let userData = [Alice, Bob]
    await fs.writeFileAsync(userFile, JSON.stringify(userData, null, '  '))

    let fruitmix = new Fruitmix({ fruitmixDir, boundVolume, useSmb: true })
    let app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
    await new Promise(res => fruitmix.once('FruitmixStarted', () => res()))

    fruitmix.nfs.update(fake.storage)

    watson = new Watson({ app })

    await new Promise((resolve, reject) => 
      watson.login('alice', 'alice', err => err ? reject(err) : resolve()))

    alice = watson.users.alice

    // start samba
    await new Promise((resolve, reject) => 
      request(watson.app.express)
        .patch('/samba')
        .set('Authorization', 'JWT ' + alice.token)
        .send({ op: 'start' })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    await Promise.delay(1000)

    body = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .patch(`/users/${alice.uuid}`)
        .set('Authorization', 'JWT ' + alice.token)
        .send({
          smbPassword: 'newPassword'
        })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    console.log(body)

    await Promise.delay(3000)

    shares = await browseAsync()
    expect(shares.sort()).to.deep.equal([
      Alice.phoneNumber,
      '默认共享盘'
    ])

    // old password should fail
    let r = await accessAsync(Alice.phoneNumber, Alice.phoneNumber, 'alice')
    expect(r.stdout.toString()).to.includes('NT_STATUS_LOGON_FAILURE')

    // new password should succeed
    r = await accessAsync(Alice.phoneNumber, Alice.phoneNumber, 'newPassword')
    expect(r.err).to.equal(null)
  }) 

/**
  it('bob changes his samba password and new password should take effect, 53937856', async function () {
    
  })
*/ 
})
