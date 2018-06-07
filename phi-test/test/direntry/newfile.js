const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const UUID = require('uuid')
const ioctl = require('ioctl')
const xattr = require('fs-xattr')
const { isUUID } = require('validator')

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

// node src/utils/md4Encrypt.js alice

const generateAppendedFile = (src, hash) => {

  let dst = path.join(tmptest, UUID.v4())

  let srcFd = fs.openSync(src, 'r')
  let dstFd = fs.openSync(dst, 'w')
  ioctl(dstFd, 0x40049409, srcFd)      
  fs.closeSync(dstFd)
  fs.closeSync(srcFd)

  dstFd = fs.openSync(dst, 'a')
  let buf = Buffer.from(hash, 'hex')
  if (buf.length !== 32) throw new Error('invalid hash string')
  fs.writeSync(dstFd, buf)
  fs.closeSync(dstFd)

  return dst
}

const retrieveXstat = target => {
  let name = path.basename(target)
  let attr = JSON.parse(xattr.getSync(target, 'user.fruitmix'))
  let stat = fs.lstatSync(target)

  if (stat.isFile()) {
    return Object.keys(attr).reduce((obj, key) => {
      if (key !== 'time') obj[key] = attr[key] 
      return obj
    }, { 
      type: 'file', 
      name, 
      size: stat.size,
      mtime: stat.mtime.getTime()
    })
  } else if (stat.isFile()) {
    return {
      type: 'directory',
      name,
      mtime: stat.mtime.getTime(),
      uuid: attr.uuid 
    }
  } else {
    throw new Error('target is neither a regular file nor a directory')
  }
}

const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  status: 'ACTIVE',
  phicommUserId: 'alice'
}

const bob = {
  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
  username: 'bob',
  password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
  smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  status: 'ACTIVE',
  phicommUserId: 'bob'
}

const charlie = {
  uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
  username: 'charlie',
  password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
  smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  status: 'ACTIVE',
  phicommUserId: 'charlie'
}

const {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync
} = require('../lib')


describe(path.basename(__filename), () => {
  const requestToken = (express, userUUID, password, callback) =>
    request(express)
      .get('/token')
      .auth(userUUID, password)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body.token))

  const requestTokenAsync = Promise.promisify(requestToken)

  const requestHome = (express, userUUID, token, callback) =>
    request(express)
      .get('/drives')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        let home = res.body.find(d => d.type === 'private' && d.owner === userUUID)
        if (!home) {
          callback(new Error('home drive not found'))
        } else {
          callback(null, home)
        }
      })

  const requestHomeAsync = Promise.promisify(requestHome)

  let policies = [
    undefined,
    [null, null],
    [null, 'skip'],
    [null, 'replace'],
    [null, 'rename'],
    ['skip', null],
    ['skip', 'skip'],
    ['skip', 'replace'],
    ['skip', 'rename'],
    ['replace', null],
    ['replace', 'skip'],
    ['replace', 'replace'],
    ['replace', 'rename'],
    ['rename', null],
    ['rename', 'skip'],
    ['rename', 'replace'],
    ['rename', 'rename']
  ]

  describe('alice home, invalid name, size, sha256, policy', () => {
    let fruitmix, app, token, home, url
    let alonzo = FILES.alonzo

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      fruitmix = new Fruitmix({ fruitmixDir })
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
      url = `/drives/${home.uuid}/dirs/${home.uuid}/entries`
    })


    ;['hello/world', 'hello|world'].forEach(name => {
      it(`400 if name ${name}`, done => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach(name, alonzo.path, JSON.stringify({
            op: 'newfile',
            size: alonzo.size,
            sha256: alonzo.hash
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.result[0].name).to.equal(name)
            expect(res.body.result[0].error.status).to.equal(400)
            done()
          })
      })
    })

    ;[undefined, 'hello', {}, [], 99.99, -1, 1024 * 1024 * 1024 + 1].forEach(size => {
      it(`400 if size is ${size}`, done => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach('hello', alonzo.path, JSON.stringify({
            op: 'newfile',
            size: size,
            sha256: alonzo.hash
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            let r0 = res.body.result[0]
            expect(r0.name).to.equal('hello')
            expect(r0.fromName).to.equal('hello')
            expect(r0.toName).to.equal('hello')
            expect(r0.type).to.equal('file')
            expect(r0.op).to.equal('newfile')
            expect(r0.size).to.deep.equal(size)
            expect(r0.sha256).to.equal(alonzo.hash)
            expect(r0.error.status).to.equal(400)
            done()
          })
      })
    })

    /**
    undefined is allowed. Though the following case with undefined sha256 will pass,
    it is not because undefined sha256 is invalid, it is because uploaded file
    does not have the trailing hash.
    */
    ;[/* undefined,*/ 1, {}, [], 'hello'].forEach(sha256 => {
      it(`400 if sha256 is ${sha256}`, done => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach('hello', alonzo.path, JSON.stringify({
            op: 'newfile',
            size: alonzo.size,
            sha256: sha256
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            let r0 = res.body.result[0]
            expect(r0.name).to.equal('hello')
            expect(r0.fromName).to.equal('hello')
            expect(r0.toName).to.equal('hello')
            expect(r0.type).to.equal('file')
            expect(r0.op).to.equal('newfile')
            expect(r0.size).to.equal(alonzo.size)
            expect(r0.sha256).to.deep.equal(sha256)
            expect(r0.error.status).to.equal(400)
            done()
          })
      })
    })

    ;[1, 'hello', {}, [], [null, null, null], ['hello', null], [null, 'hello']].forEach(policy => {
      it(`400 if policy is ${String(policy)}`, done => {
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach('hello', alonzo.path, JSON.stringify({
            op: 'newfile',
            size: alonzo.size,
            sha256: alonzo.hash,
            policy,
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            let r0 = res.body.result[0]
            expect(r0.name).to.equal('hello')
            expect(r0.fromName).to.equal('hello')
            expect(r0.toName).to.equal('hello')
            expect(r0.type).to.equal('file')
            expect(r0.op).to.equal('newfile')
            expect(r0.size).to.equal(alonzo.size)
            expect(r0.sha256).to.equal(alonzo.hash)
            expect(r0.policy).to.deep.equal(policy)
            expect(r0.error.status).to.equal(400)
            done()
          })
      })
    })
  }) 

  describe('alice home, upload 6 plain files, no policy, no conflict', () => {
    let fruitmix, app, token, home, url
    let { empty, oneByteX, halfGiga, oneGigaMinus1, oneGiga } = FILES

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      fruitmix = new Fruitmix({ fruitmixDir })
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
      url = `/drives/${home.uuid}/dirs/${home.uuid}/entries`
    })

   
    ;[empty, oneByteX, halfGiga, oneGigaMinus1, oneGiga].forEach(file => {

      it(`200 newfile ${file.name}, pre`, function (done) {
        this.timeout(0)
        request(app.express) 
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach(file.name, file.path, JSON.stringify({
            op: 'newfile',
            size: file.size,
            sha256: file.hash
          }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            let target = path.join(fruitmixDir, 'drives', home.uuid, file.name)
            expect(res.body[0]).to.deep.include({
              type: 'file',
              name: file.name,
              op: 'newfile',
              size: file.size,
              sha256: file.hash,
              policy: [null, null],
              resolved: [false, false],
              data: retrieveXstat(target)
            })
            done()
          })
      })

      it(`200 newfile ${file.name}, post`, function (done) {
        this.timeout(0)

        let tmp = generateAppendedFile(file.path, file.hash)
        request(app.express) 
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach(file.name, tmp, JSON.stringify({
            op: 'newfile',
            size: file.size,
          }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            let target = path.join(fruitmixDir, 'drives', home.uuid, file.name)
            expect(res.body[0]).to.deep.include({
              type: 'file',
              name: file.name,
              op: 'newfile',
              size: file.size,
              sha256: file.hash,
              policy: [null, null],
              resolved: [false, false],
              data: retrieveXstat(target)
            })
            done()
          })
      })
    })
  })

})
