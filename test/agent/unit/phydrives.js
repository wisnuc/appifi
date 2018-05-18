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

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const fps = require('src/utils/fingerprintSimple')
const fakeNfsAsync = require('test/lib/nfs')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

// node src/utils/md4Encrypt.js alice

const FILES = require('./lib').FILES

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

const fileENOENT = path => {
  try {
    fs.statSync(path)
    return false
  } catch (e) {
    return e.code === 'ENOENT'
  }
}

const Mkpath = (root, relpath) => path.join(root, relpath)

const Mkdir = (root, relpath) => {
  let dirPath = path.join(root, relpath) 
  mkdirp.sync(dirPath)
  expect(fs.lstatSync(dirPath).isDirectory()).to.be.true
  return dirPath
}

const Mkfile = (root, relpath, data) => {
  Mkdir(root, path.dirname(relpath))
  let filePath = path.join(root, relpath)
  fs.writeFileSync(filePath, data)
  expect(fs.lstatSync(filePath).isFile()).to.be.true
  return filePath
}

const Mklink = (root, relpath) => {
  Mkdir(root, path.dirname(relpath))
  let linkPath = path.join(root, relpath)
  fs.symlinkSync('/dev/null', linkPath)
  expect(fs.lstatSync(linkPath).isSymbolicLink()).to.be.true
  return linkPath
}

const ExpectDir = (root, relpath) => {
  let dirPath = path.join(root, relpath)  
  expect(fs.lstatSync(dirPath).isDirectory()).to.be.true
}

const ExpectFile = (root, relpath, data) => {
  let filePath = path.join(root, relpath)
  if (data) {
    expect(fs.readFileSync(filePath).toString()).to.equal(data)
  } else {
    expect(fs.lstatSync(filePath).isFile()).to.be.true
  }
}

const ExpectFileHash = (root, relpath, hash) => {
  let filePath = path.join(root, relpath)
  expect(fps.sync(filePath)).to.equal(hash)
}

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

  
  describe.skip('alice', () => {
    let fruitmix, app, token, home, fake, boundVolume
    const invalidIds = []
    const invalidPaths = []

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      fake = await fakeNfsAsync(tmptest)
      boundVolume = fake.createBoundVolume(fake.storage, fake.UUIDBC)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      let opts = { fruitmixDir, boundVolume }
      fruitmix = new Fruitmix(opts)
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
    })

    it('should list drives', done => {
      fruitmix.nfs.update(fake.storage)
      request(app.express)
        .get(`/phy-drives`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          console.log(res.body)
          done()
        })
    })

    it('should list something ???', done => {
      fruitmix.nfs.update(fake.storage) 
      request(app.express)
        .get(`/phy-drives/${boundVolume.uuid}`)
        .set('Authorization', 'JWT ' + token)
        .expect(404)
        .end(done)
    })

    it('should list something ???, d1396baf', done => {
      fruitmix.nfs.update(fake.storage) 
      request(app.express)
        .get(`/phy-drives/${fake.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })


    it('should list something ???, d1396baf', done => {
      fruitmix.nfs.update(fake.storage) 
      request(app.express)
        .get(`/phy-drives/${fake.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: '../sddexyz' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })

    it('should list something ???, d1396baf', done => {
      fruitmix.nfs.update(fake.storage) 
      request(app.express)
        .get(`/phy-drives/${fake.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: '../sddexyz' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })

    it('should list something ???, d1396baf', done => {
      fruitmix.nfs.update(fake.storage) 
      request(app.express)
        .get(`/phy-drives/${fake.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: 'hello' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([])
          done()
        })
    })

  }) 

  describe('mkdir and newfile, path via qs', () => {
   let fruitmix, app, token, home, fake, boundVolume

    const mkdir = Mkdir.bind(null, path.join(tmptest, 'sdde'))
    const mkfile = Mkfile.bind(null, path.join(tmptest, 'sdde'))
    const mklink = Mklink.bind(null, path.join(tmptest, 'sdde'))
    const mkpath = Mkpath.bind(null, path.join(tmptest, 'sdde'))
    const expectDir = ExpectDir.bind(null, path.join(tmptest, 'sdde'))
    const expectFile = ExpectFile.bind(null, path.join(tmptest, 'sdde'))
    const expectFileHash = ExpectFileHash.bind(null, path.join(tmptest, 'sdde'))

    const invalidIds = ['hello', fakeNfsAsync.UUIDBC]
    const invalidPaths = ['*', '/hello', 'hello/', 'hello//world'] 
    const invalidPreludes = ['*', ...['hello', null].map(x => JSON.stringify(x))]
    const invalidFilenames = ['*']

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      fake = await fakeNfsAsync(tmptest)
      boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      let opts = { fruitmixDir, boundVolume }
      fruitmix = new Fruitmix(opts)
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
      fruitmix.nfs.update(fake.storage)
    })

    describe('id red', () => {
      invalidIds.forEach(iid => {
        it(`404 if id is ${iid}`, done => {
          request(app.express)
            .post(`/phy-drives/${iid}`) // <-- invalid id
            .set('Authorization', 'JWT ' + token)
            .query({ path: '' })
            .field('directory', 'hello')
            .expect(404)
            .end(done)
        }) 
      })
    })

    describe('path red, invalid name', () => {
      invalidPaths.forEach(path => {
        it(`400 if path is ${path}`, done => {
          request(app.express)
            .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
            .set('Authorization', 'JWT ' + token)
            .query({ path })
            .field('directory', 'hello')
            .expect(400)
            .end(done)
        })
      }) 
    })

    describe('path red, non-existent target', () => {
      it(`403 if path hello on /`, done => {
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: 'hello' })
          .field('directory', 'world')
          .expect(403)
          .end(done)
      })

      it(`403 if path hello/world on /hello (dir)`, done => {
        let dirPath = path.join(tmptest, 'sdde', 'hello')
        mkdirp.sync(dirPath)
        expect(fs.lstatSync(dirPath).isDirectory()).to.be.true 
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: 'hello/world' })
          .field('directory', 'world')
          .expect(403)
          .end(done)
      })

      it(`403 if path hello/world on /hello (file)`, done => {
        let filePath = path.join(tmptest, 'sdde', 'hello')
        fs.writeFileSync(filePath, 'hello')
        expect(fs.lstatSync(filePath).isFile()).to.be.true
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: 'hello/world' })
          .field('directory', 'world')
          .expect(403)
          .end(done)
      })
    })

    describe('path red, target is file', () => {
      it(`403 if path is hello on /hello (file)`, done => {
        let filePath = path.join(tmptest, 'sdde', 'hello')
        fs.writeFileSync(filePath, 'hello')
        expect(fs.lstatSync(filePath).isFile()).to.be.true
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: 'hello' })
          .field('directory', 'world')
          .expect(403)
          .end(done)
      })

      it(`403 if path is hello/world on /hello/world (file)`, done => {
        let dirPath = path.join(tmptest, 'sdde', 'hello')
        let filePath = path.join(tmptest, 'sdde', 'hello', 'world')
        mkdirp.sync(dirPath)
        fs.writeFileSync(filePath, 'hello')
        expect(fs.lstatSync(filePath).isFile()).to.be.true
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: 'hello/world' })
          .field('directory', 'world')
          .expect(403)
          .end(done)
      })
    })

    describe('part red, invalid field/body', () => {
      it(`400 if part name is hello (invalid name field)`, done => {
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: '' })
          .field('hello', 'world')
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.index).to.equal(0)
            done()
          })
      })

      invalidFilenames.forEach(iname => 
        it(`400 if directory part has invalid dir name ${iname}`, done => {
          request(app.express)
            .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
            .set('Authorization', 'JWT ' + token)
            .query({ path: '' })
            .field('directory', iname)
            .expect(400)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.index).to.equal(0)
              done()
            })
        }))

      invalidFilenames.forEach(iname => 
        it(`400 if file part has invalid file name ${iname}`, done => {
          request(app.express)
            .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
            .set('Authorization', 'JWT ' + token)
            .query({ path: '' })
            .attach('file', FILES.alonzo.path, iname)
            .expect(400)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.index).to.equal(0)
              done()
            })
        }))
    })

    describe('op with name conflict', () => {
      /**
      0: expected status code
      1: op type
      2: full path
      3: target type
      */
      let tests = [
        [403, 'file', 'hello', 'file', 'EEXIST'],
        [403, 'file', 'hello/world', 'file', 'EEXIST'],
        [403, 'file', 'hello', 'directory', 'EISDIR'],
        [403, 'file', 'hello/world', 'directory', 'EISDIR'],
        [403, 'file', 'hello', 'symlink', 'EISSYMLINK'],
        [403, 'file', 'hello/world', 'symlink', 'EISSYMLINK'], 
        [200, 'directory', 'hello', 'directory'],
        [200, 'directory', 'hello/world', 'directory'],
        [403, 'directory', 'hello', 'file', 'EISFILE'],
        [403, 'directory', 'hello/world', 'file', 'EISFILE'],
        [403, 'directory', 'hello', 'symlink', 'EISSYMLINK'],
        [403, 'directory', 'hello/world', 'symlink', 'EISSYMLINK'],
      ]

      tests.forEach(t => {
        let dirname = t[2].slice(0, t[2].lastIndexOf('/') + 1).slice(0, -1)
        let basename = t[2].split('/').pop()

        it(`${t[0]} new ${t[1]} ${basename} on ${'/' + dirname} if ${'/'+t[2]} is ${t[3]}`, done => {

          if (t[3] === 'directory') {
            mkdir(t[2])
          } else if (t[3] === 'file') {
            mkfile(t[2], basename)
          } else if (t[3] === 'symlink') {
            mklink(t[2])
          } else {
            throw new Error('unknown type')
          }

          if (t[1] === 'directory') {
            request(app.express)
              .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
              .set('Authorization', 'JWT ' + token)
              .query({ path: dirname })
              .field('directory', basename)
              .expect(t[0])
              .end((err, res) => {
                if (err) return done(err)
                if (t[0] === 200) {
                  expectDir(t[2])
                } else {
                  expect(res.body.code).to.equal(t[4])
                  expect(res.body.index).to.equal(0)
                }
                done()
              })
          } else {
            request(app.express)
              .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
              .set('Authorization', 'JWT ' + token)
              .query({ path: dirname })
              .attach('file', FILES.alonzo.path, basename)
              .expect(t[0])
              .end((err, res) => {
                if (err) return done(err)
                if (t[0] === 200) {
                  expectFileHash(t[2], FILES.alonzo.hash)
                } else {
                  if (t[4]) expect(res.body.code).to.equal(t[4]) 
                  expect(res.body.index).to.equal(0)
                }
                done()
              })
          }
        })

      })
    })

    describe('op without conflict', () => {
      it(`200 new directory hello on /`, done => {
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: '' })
          .field('directory', 'hello')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            let dirPath = path.join(tmptest, 'sdde', 'hello')
            expect(fs.lstatSync(dirPath).isDirectory()).to.be.true
            done()
          })
      })

      it(`200 new directory world on /hello`, done => {
        mkdir('hello')
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: 'hello' })
          .field('directory', 'world')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expectDir('hello/world')
            done()
          })
      })

      it(`200 new file hello on /`, done => {
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: '' })
          .attach('file', FILES.alonzo.path, 'hello')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expectFileHash('hello', FILES.alonzo.hash)
            done()
          })
      })

      it(`200 new file world on /hello`, done => {
        mkdir('hello')
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: 'hello' })
          .attach('file', FILES.alonzo.path, 'world')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expectFileHash('hello/world', FILES.alonzo.hash)
            done()
          })
      })
    }) 

  })

  describe('mkdir and newfile', () => {
    let fruitmix, app, token, home, fake, boundVolume

    const invalidIds = ['hello', fakeNfsAsync.UUIDBC]
    const invalidPaths = ['*', '/hello', 'hello/', 'hello//world'] 
    const invalidPreludes = ['*', ...['hello', null].map(x => JSON.stringify(x))]
    const invalidFilenames = ['*']

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      fake = await fakeNfsAsync(tmptest)
      boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      let opts = { fruitmixDir, boundVolume }
      fruitmix = new Fruitmix(opts)
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
      fruitmix.nfs.update(fake.storage)
    })

    // id red
    invalidIds.forEach(iid => {
      it(`404 if id is ${iid}`, done => {
        request(app.express)
          .post(`/phy-drives/${iid}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: '' })
          .field('directory', 'hello')
          .expect(404)
          .end(done)
      }) 
    })

    // path red
    invalidPaths.forEach(path => {
      it(`400 if path is ${path}`, done => {
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path })
          .field('directory', 'hello')
          .expect(400)
          .end(done)
      })
    }) 

    // part red 1 invalid name hello
    it(`400 if part name is hello`, done => {
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: '' })
        .field('hello', 'world')
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.index).to.equal(0)
          done()
        })
    })

    // part red 2 invalid dir name
    invalidFilenames.forEach(iname => 
      it(`400 if directory part has invalid dir name ${iname}`, done => {
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: '' })
          .field('directory', iname)
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.index).to.equal(0)
            done()
          })
      }))

    // part red 3 invalid file name
    invalidFilenames.forEach(iname => 
      it(`400 if file part has invalid file name ${iname}`, done => {
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .query({ path: '' })
          .attach('file', FILES.alonzo.path, iname)
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.index).to.equal(0)
            done()
          })
      }))

    it(`200 if directory hello`, done => {
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: '' })
        .field('directory', 'hello')
        .expect(200) 
        .end((err, res) => {
          if (err) return done(err)
          let dirPath = path.join(tmptest, 'sdde', 'hello')
          let stats = fs.statSync(dirPath)
          expect(stats.isDirectory()).to.be.true
          done()
        })
    })

    it(`200 if file alonzo`, done => {
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: '' })
        .attach('file', FILES.alonzo.path, FILES.alonzo.name)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let dirPath = path.join(tmptest, 'sdde', FILES.alonzo.name)
          expect(fps.sync(dirPath)).to.equal(FILES.alonzo.hash)
          done()
        })
    })

    invalidPreludes.forEach(prelude => {
      it(`400 if prelude is ${prelude}`, done => {
        request(app.express)
          .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .field('prelude', prelude)
          .field('directory', 'hello')
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.index).to.equal(-1)
            done()
          })
      })
    }) 

    it(`200 if prelude is {} (defaults to root)`, done => {
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .field('prelude', JSON.stringify({}))
        .expect(200)
        .end(done)
    }) 

    it(`200 if prelude is { path: '' } (root)`, done => {
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .field('prelude', JSON.stringify({ path: '' }))
        .expect(200)
        .end(done)
    })

    it(`200 if prelude path hello exist`, done => {
      mkdirp.sync(path.join(tmptest, 'sdde', 'hello'))
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .field('prelude', JSON.stringify({ path: 'hello' }))
        .expect(200)
        .end(done)
    })

    it(`403 if prelude path hello non-exist`, done => {
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .field('prelude', JSON.stringify({ path: 'hello' }))
        .expect(403)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.index).to.equal(-1)
          done()
        })
    })

    it(`403 if prelude path is a file`, done => {
      fs.writeFileSync(path.join(tmptest, 'sdde', 'hello'), 'hello')
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .field('prelude', JSON.stringify({ path: 'hello' }))
        .field('directory', 'world')
        .expect(403)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.index).to.equal(-1)
          done()
        })
    })

    it(`200 prelude { path: '' } mkdir hello`, done => {
      request(app.express)
        .post(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .field('prelude', JSON.stringify({ path: '' }))
        .field('directory', 'hello')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let dirPath = path.join(tmptest, 'sdde', 'hello')
          expect(fs.statSync(dirPath).isDirectory()).to.be.true
          done()
        })
    })
  }) 

  describe('rename', () => {

    let fruitmix, app, token, home, fake, boundVolume

    const invalidIds = ['hello', fakeNfsAsync.UUIDBC]
    const invalidPaths = ['*', '/hello', 'hello/', 'hello//world'] 

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      fake = await fakeNfsAsync(tmptest)
      boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      let opts = { fruitmixDir, boundVolume }
      fruitmix = new Fruitmix(opts)
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
      fruitmix.nfs.update(fake.storage)
    })

    invalidIds.forEach(iid => {
      it(`404 if id is ${iid}`, done => {
        request(app.express)
          .patch(`/phy-drives/${iid}`)
          .set('Authorization', 'JWT ' + token)
          .send({ oldPath: 'hello', newPath: 'world' })
          .expect(404)
          .end(done)
      })
    })

    ;[...invalidPaths, undefined, 0, {}].forEach(oldPath => {
      it(`400 if oldPath is ${oldPath}, newPath is hello`, done => {
        request(app.express)
          .patch(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .send({ oldPath, newPath: 'hello' })
          .expect(400)
          .end(done)
      })  
    }) 

    ;[...invalidPaths, undefined, 0, {}].forEach(newPath => {
      it(`400 if oldPath is hello, newPath is ${newPath}`, done => {
        request(app.express)
          .patch(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token)
          .send({ oldPath: 'hello', newPath })
          .expect(400)
          .end(done)
      })  
    })

    it('200 rename hello to world when world not exist', done => {
      let hello = path.join(tmptest, 'sdde', 'hello')
      let world = path.join(tmptest, 'sdde', 'world')
      mkdirp.sync(hello) 
      expect(fileENOENT(hello)).to.be.false
      request(app.express)
        .patch(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .send({ oldPath: 'hello', newPath: 'world' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(fileENOENT(hello)).to.be.true
          expect(fileENOENT(world)).to.be.false
          done()
        })
    }) 

    it('200 rename hello to world when world exist (overwriting file)', done => {
      let hello = path.join(tmptest, 'sdde', 'hello')
      let world = path.join(tmptest, 'sdde', 'world')
      fs.writeFileSync(hello, 'hello')
      fs.writeFileSync(world, 'world')
      request(app.express)
        .patch(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .send({ oldPath: 'hello', newPath: 'world' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(fileENOENT(hello)).to.be.true
          expect(fs.readFileSync(world).toString()).to.equal('hello')
          done()
        })
    }) 
  })

  describe('delete', () => {

    let fruitmix, app, token, home, fake, boundVolume

    const invalidIds = ['hello', fakeNfsAsync.UUIDBC]
    const invalidPaths = ['*', '/hello', 'hello/', 'hello//world'] 

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      fake = await fakeNfsAsync(tmptest)
      boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      let opts = { fruitmixDir, boundVolume }
      fruitmix = new Fruitmix(opts)
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
      fruitmix.nfs.update(fake.storage)
    })

    invalidIds.forEach(iid => 
      it(`404 if id is ${iid}`, done => {
        request(app.express)
          .delete(`/phy-drives/${iid}`)
          .set('Authorization', 'JWT ' + token)
          .expect(404)
          .end(done)
      }))

    ;[...invalidPaths, ''].forEach(path => 
      it(`400 if path is ${path === '' ? '(empty)' : path}`, done => {
        request(app.express)
          .delete(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
          .set('Authorization', 'JWT ' + token) 
          .query({ path }) 
          .expect(400)
          .end(done)
      }))

    it(`400 if path is not provided`, done => {
      request(app.express)
        .delete(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token) 
        .expect(400)
        .end(done)
    })

    it('200 delete /hello on / (idempotent)', done => {
      request(app.express)
        .delete(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: 'hello' })
        .expect(200)
        .end(done)
    }) 
  
    it('200 delete /hello on /hello', done => {
      let hello = path.join(tmptest, 'sdde', 'hello')
      mkdirp.sync(hello)
      expect(fileENOENT(hello)).to.be.false 
      request(app.express)
        .delete(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: 'hello' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(fileENOENT(hello)).to.be.true
          done()
        })
    }) 

    it('200 delete /hello/world on / (idempotent)', done => {
      request(app.express)
        .delete(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: 'hello/world' })
        .expect(200)
        .end(done)
    })

    it('200 delete /hello/world on /hello (idempotent)', done => {
      let hello = path.join(tmptest, 'sdde', 'hello')
      mkdirp.sync(hello)
      expect(fileENOENT(hello)).to.be.false
      request(app.express)
        .delete(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: 'hello/world' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(fileENOENT(hello)).to.be.false
          done()
        })
    })

    it('200 delete /hello/world on /hello/world', done => {
      let world = path.join(tmptest, 'sdde', 'hello', 'world')
      mkdirp.sync(world)
      expect(fileENOENT(world)).to.be.false
      request(app.express)
        .delete(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: 'hello/world' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(fileENOENT(world)).to.be.true
          expect(fileENOENT(path.dirname(world))).to.be.false
          done()
        })
    })

    it('403 delete /hello/world on /hello (file)', done => {
      let hello = path.join(tmptest, 'sdde', 'hello')
      fs.writeFileSync(hello, 'hello')
      expect(fileENOENT(hello)).to.be.false
      request(app.express)
        .delete(`/phy-drives/${fakeNfsAsync.UUIDDE}`)
        .set('Authorization', 'JWT ' + token)
        .query({ path: 'hello/world' })
        .expect(403)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.code).to.equal('ENOTDIR')
          done()
        })
    })

  })
})
