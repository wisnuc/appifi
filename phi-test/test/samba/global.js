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
  phoneNumber: '13900000001'
}

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

  let watson, user, fake

  const prepareAsync = async () => {
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
  }

  it('smb is started before starting fruitmix', async function () {
    let stdout

    this.timeout(0)
    await child.execAsync('systemctl enable smbd')
    await child.execAsync('systemctl start smbd')
    await Promise.delay(1000)

    stdout = await child.execAsync('systemctl is-enabled smbd')
    expect(stdout.trim()).to.equal('enabled')

    stdout = await child.execAsync('systemctl is-active smbd')
    expect(stdout.trim()).to.equal('active')

    await prepareAsync()

    let x = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(x.state).to.equal('Started')
  })

  it('smb is stopped before starting fruitmix', async function () {
    let stdout

    this.timeout(0)

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

    await prepareAsync()

    let x = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(x.state).to.equal('Stopped')
  })

  it('rm smb.conf, start smb before starting fruitmix, stop & start again, cb4b6dc5', async function () {
    let stdout, shares, body

    this.timeout(0)

    // rm smb.conf
    await fs.writeFileAsync('/etc/samba/smb.conf', '\n')
    await child.execAsync('systemctl enable smbd')
    await child.execAsync('systemctl start smbd')
    await Promise.delay(1000)

    stdout = await child.execAsync('systemctl is-enabled smbd')
    expect(stdout.trim()).to.equal('enabled')

    stdout = await child.execAsync('systemctl is-active smbd')
    expect(stdout.trim()).to.equal('active')

    shares = await browseAsync()

    // assert shares cleaned
    expect(shares).to.deep.equal([])

    await prepareAsync()

    body = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(body.state).to.equal('Started')

    await Promise.delay(1000)

    shares = await browseAsync()
    expect(shares.sort()).to.deep.equal([alice.phoneNumber, '默认共享盘'].sort()) 

    // stop via patch
    await new Promise((resolve, reject) => 
      request(watson.app.express)
        .patch('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .send({ op: 'stop' }) 
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // assert stopped via api
    body = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(body.state).to.equal('Stopped')

    // assert stopped in system 
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

    // start via patch
    await new Promise((resolve, reject) => 
      request(watson.app.express) 
        .patch('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .send({ op: 'start' })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // assert started via api
    body = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(body.state).to.equal('Started')

    await Promise.delay(1000)

    shares = await browseAsync()  

    expect(shares.sort()).to.deep.equal([alice.phoneNumber, '默认共享盘'].sort())
  })

  it('rm smb.conf, stop smb before starting fruitmix, start and stop again, 910ac6bf', async function () {
    let stdout, shares, body

    this.timeout(0)   

    // rm smb.conf
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

    await prepareAsync()

    body = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(body.state).to.equal('Stopped')

    // start via patch  
    await new Promise((resolve, reject) => 
      request(watson.app.express)
        .patch('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .send({ op: 'start' })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // assert started via api
    body = await new Promise((resolve, reject) =>
      request(watson.app.express)
        .get('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(body.state).to.equal('Started')

    // assert started in system
    stdout = await child.execAsync('systemctl is-active smbd')
    expect(stdout.trim()).to.equal('active')

    stdout = await child.execAsync('systemctl is-enabled smbd')
    expect(stdout.trim()).to.equal('enabled')

    await Promise.delay(1000)

    shares = await browseAsync()
    expect(shares.sort()).to.deep.equal([alice.phoneNumber, '默认共享盘'])

    // stop via patch
    await new Promise((resolve, reject) =>
      request(watson.app.express)
        .patch('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .send({ op: 'stop' })
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    // assert stopped via api
    body = await new Promise((resolve, reject) => 
      request(watson.app.express)
        .get('/samba')
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => err ? reject(err) : resolve(res.body)))

    expect(body.state).to.equal('Stopped')

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
  }) 

})
