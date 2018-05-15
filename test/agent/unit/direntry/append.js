const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const xattr = require('fs-xattr')
const ioctl = require('ioctl')
const UUID = require('uuid')

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const { createTestFilesAsync } = require('src/utils/createTestFiles')
const fps = require('src/utils/fingerprintSimple')

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
  phicommUserId: 'alice'
}

const bob = {
  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
  username: 'bob',
  password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
  smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'bob'
}

const charlie = {
  uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
  username: 'charlie',
  password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
  smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'charlie'
}

const FILES = require('../lib').FILES

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

  describe('alice home, invalid name', () => {
    let fruitmix, app, token, home, url
    let { alonzo, empty, oneByteX, halfGiga, oneGigaMinus1,
      oneGiga, twoGiga, threeGiga, fourGiga, fiveGiga } = FILES

    beforeEach(async () => {
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
      it(`400 if name is ${String(name)}`, function (done) {
        this.timeout(0)
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach(name, alonzo.path, JSON.stringify({
            op: 'append',
            hash: alonzo.hash, // same result with or without hash
            size: alonzo.size,
            sha256: alonzo.hash
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.result[0]).to.include(JSON.parse(JSON.stringify({
              name,
              type: 'file',
              op: 'append',
              hash: alonzo.hash,
              size: alonzo.size,
              sha256: alonzo.hash
            })))
            expect(res.body.result[0].error.status).to.equal(400)
            done()
          })
      })
    })

    ;[undefined, 1, 'hello', alonzo.hash.toUpperCase()].forEach(hash => {
      it(`400 if hash is ${String(hash)}`, function (done) {
        this.timeout(0)
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach(alonzo.name, alonzo.path, JSON.stringify({
            op: 'append',
            hash,
            size: alonzo.size,
            sha256: alonzo.hash
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.result[0]).to.include(JSON.parse(JSON.stringify({
              name: alonzo.name,
              type: 'file',
              op: 'append',
              hash,
              size: alonzo.size,
              sha256: alonzo.hash
            })))
            expect(res.body.result[0].error.status).to.equal(400)
            done()
          })
      })
    })

    ;[undefined, 'hello', 99.99, -1, 0, 1024 * 1024 * 1024 + 1].forEach(size => {
      it(`400 if size is ${String(size)}`, function (done) {
        this.timeout(0)
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach(alonzo.name, alonzo.path, JSON.stringify({
            op: 'append',
            hash: alonzo.hash,
            size,
            sha256: alonzo.hash
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.result[0]).to.include(JSON.parse(JSON.stringify({
              name: alonzo.name,
              type: 'file',
              op: 'append',
              size,
              hash: alonzo.hash,
              sha256: alonzo.hash
            })))
            expect(res.body.result[0].error.status).to.equal(400)
            done()
          })
      })
    })

    /** undefined is allowed **/
    ;[1, 'hello'].forEach(sha256 => {
      it(`400 if sha256 is ${String(sha256)}`, function (done) {
        this.timeout(0)
        request(app.express)
          .post(url)
          .set('Authorization', 'JWT ' + token)
          .attach(alonzo.name, alonzo.path, JSON.stringify({
            op: 'append',
            hash: alonzo.hash,
            size: alonzo.size,
            sha256
          }))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.result[0]).to.include(JSON.parse(JSON.stringify({
              name: alonzo.name,
              type: 'file',
              op: 'append',
              size: alonzo.size,
              hash: alonzo.hash,
              sha256
            })))
            expect(res.body.result[0].error.status).to.equal(400)
            done()
          })
      })
    })

    /**
    it(`* 403 if target does NOT exist`, function (done) {
      this.timeout(0)
      request(app.express)
        .post(url)
        .set('Authorization', 'JWT' + token)
        .attach(empty.name, empty.path, JSON.stringify({
          op: 'newfile',
          size: empty.size,
          sha256: empty.sha256
        }))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
        })

      request(app.express)
        .post(url)
        .set('Authorization', 'JWT ' + token)
        .attach(alonzo.name, alonzo.path, JSON.stringify({
          op: 'append',
          hash: alonzo.hash,
          size: alonzo.size,
          sha256: alonzo.hash
        }))
        .expect(403)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.result[0].name).to.equal(alonzo.name)
          expect(res.body.result[0].hash).to.equal(alonzo.hash)
          expect(res.body.result[0].error.status).to.equal(403)
          done()
        })
    }) **/

    let appendices = [oneByteX, halfGiga, oneGigaMinus1, oneGiga]
    let appendees = [empty, oneGiga, twoGiga, threeGiga, fourGiga, fiveGiga]

    appendees.forEach(appendee => {
      appendices.forEach(file => {
        it(`200 append ${file.name} to ${appendee.name}, pre, c29d37ea`, function (done) {
          this.timeout(0)
          request(app.express)
            .post(url)
            .set('Authorization', 'JWT ' + token)
            .attach(appendee.name, appendee.path, JSON.stringify({
              op: 'newfile',
              size: appendee.size,
              sha256: appendee.hash
            }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              request(app.express)
                .post(url)
                .set('Authorization', 'JWT ' + token)
                .attach(appendee.name, file.path, JSON.stringify({
                  op: 'append',
                  hash: appendee.hash,
                  size: file.size,
                  sha256: file.hash
                }))
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  let target = path.join(fruitmixDir, 'drives', home.uuid, appendee.name)
                  let data = retrieveXstat(target)
                  expect(res.body[0]).to.deep.include({
                    type: 'file',
                    name: appendee.name,
                    op: 'append',
                    hash: appendee.hash,
                    size: file.size,
                    sha256: file.hash,
                    data
                  })

                  let hash = appendee.size === 0
                    ? file.hash
                    : crypto.createHash('sha256')
                      .update(Buffer.from(appendee.hash, 'hex'))
                      .update(Buffer.from(file.hash, 'hex'))
                      .digest('hex')

                  expect(data.hash).to.equal(hash)
                  expect(fps.sync(target)).to.equal(data.hash)
                  done()
                })
            })
        })

        it(`200 append ${file.name} to ${appendee.name}, post, 30c43eb8`, function (done) {
          this.timeout(0)
          request(app.express)
            .post(url)
            .set('Authorization', 'JWT ' + token)
            .attach(appendee.name, appendee.path, JSON.stringify({
              op: 'newfile',
              size: appendee.size,
              sha256: appendee.hash
            }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              let tmp = generateAppendedFile(file.path, file.hash)
              request(app.express)
                .post(url)
                .set('Authorization', 'JWT ' + token)
                .attach(appendee.name, tmp, JSON.stringify({
                  op: 'append',
                  hash: appendee.hash,
                  size: file.size
                }))
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  let target = path.join(fruitmixDir, 'drives', home.uuid, appendee.name)
                  let data = retrieveXstat(target)
                  expect(res.body[0]).to.deep.include({
                    type: 'file',
                    name: appendee.name,
                    op: 'append',
                    hash: appendee.hash,
                    size: file.size,
                    sha256: file.hash,
                    data
                  })

                  let hash = appendee.size === 0
                    ? file.hash
                    : crypto.createHash('sha256')
                      .update(Buffer.from(appendee.hash, 'hex'))
                      .update(Buffer.from(file.hash, 'hex'))
                      .digest('hex')

                  expect(data.hash).to.equal(hash)
                  expect(fps.sync(target)).to.equal(data.hash)
                  done()
                })
            })
        })
      })
    })
  })
})
