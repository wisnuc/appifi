const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const request = require('supertest')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const debug = require('debug')('fruitmove')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const broadcast = require('src/common/broadcast')
const app = require('src/app')
const getFruit = require('src/fruitmix')
const fingerprint = require('src/lib/fingerprintSync')

const {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync
} = require('./lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')
const driveDir = path.join(tmptest, 'drives')

const resetAsync = async () => {

  broadcast.emit('FruitmixStop')
  await Promise.delay(200)
  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)

  broadcast.emit('FruitmixStart', tmptest)
  await broadcast.until('FruitmixStarted')
}

const uploadTestFiles = (token, driveUUID, dirUUID, dirs, callback) => {
  let { alonzo, bar, empty, foo, hello, vpai001, world } = FILES

  let r = request(app)  
    .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
    .set('Authorization', 'JWT ' + token)
    .attach(alonzo.name, alonzo.path, JSON.stringify({
      size: alonzo.size,
      sha256: alonzo.hash
    }))
    .attach(bar.name, bar.path, JSON.stringify({
      size: bar.size,
      sha256: bar.hash
    }))
    .attach(empty.name, empty.path, JSON.stringify({
      size: empty.size,
      sha256: empty.hash
    }))
    .attach(foo.name, foo.path, JSON.stringify({
      size: foo.size,
      sha256: foo.hash
    }))
    .attach(hello.name, hello.path, JSON.stringify({
      size: hello.size,
      sha256: hello.hash
    }))
    .attach(vpai001.name, vpai001.path, JSON.stringify({
      size: vpai001.size,
      sha256: vpai001.hash
    }))
    .attach(world.name, world.path, JSON.stringify({
      size: world.size,
      sha256: world.hash
    }))

  dirs.forEach(name => r.field(name, JSON.stringify({ op: 'mkdir' })))

  r.expect(200).end((err, res) => {
    if (err) return callback(err) 

    request(app)
      .get(`/drives/${driveUUID}/dirs/${dirUUID}`)
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end(callback)
  })
}

describe(path.basename(__filename), () => {

  describe("Alice move this to that", () => {
    let { alonzo, bar, empty, foo, hello, vpai001, world } = FILES
    let dir1UUID, dir2UUID, dir3UUID, dir4UUID
    let homeEntries, dir1Entries, dir3Entries 
    let token

/**
└── e2adb5d0-c3c7-4f2a-bd64-3320a1ed0dee
    ├── alonzo_church.jpg
    ├── bar
    ├── dir1
    │   ├── alonzo_church.jpg
    │   ├── bar
    │   ├── dir3
    │   │   ├── alonzo_church.jpg
    │   │   ├── bar
    │   │   ├── empty
    │   │   ├── foo
    │   │   ├── hello
    │   │   ├── vpai001
    │   │   └── world
    │   ├── dir4
    │   ├── empty
    │   ├── foo
    │   ├── hello
    │   ├── vpai001
    │   └── world
    ├── dir2
    ├── empty
    ├── foo
    ├── hello
    ├── vpai001
    └── world
**/
    beforeEach(async function () {
      this.timeout(0)
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
      await new Promise((resolve, reject) => {
        let dirUUID = IDS.alice.home
        uploadTestFiles(token, IDS.alice.home, dirUUID, ['dir1', 'dir2'], (err, res) => {
          if (err) {
            reject(err)
          } else {
            home = res.body
            dir1UUID = res.body.entries.find(x => x.name === 'dir1').uuid
            dir2UUID = res.body.entries.find(x => x.name === 'dir2').uuid
            uploadTestFiles(token, IDS.alice.home, dir1UUID, ['dir3', 'dir4'], (err, res) => {
              if (err) {
                reject(err)
              } else {
                dir1 = res.body
                dir3UUID = res.body.entries.find(x => x.name === 'dir3').uuid
                dir4UUID = res.body.entries.find(x => x.name === 'dir4').uuid
                uploadTestFiles(token, IDS.alice.home, dir3UUID, [], (err, res) => {
                  if (err) {
                    reject(err)
                  } else {
                    dir3 = res.body
                    resolve()
                  }
                }) 
              }
            })
          }
        })
      })
    })

    it("do nothing (for checking file system), 7e3d2b84", function (done) {
      this.timeout(0)

      let vfs = getFruit().driveList
      let rootDir = vfs.findRootDirByUUID(IDS.alice.home)

/**
      expect(rootDir.linearize().map(n => n.name)).to.deep.equal([
        'e2adb5d0-c3c7-4f2a-bd64-3320a1ed0dee',
        'alonzo_church.jpg',
        'dir1',
        'alonzo_church.jpg',
        'dir3',
        'alonzo_church.jpg',
        'vpai001',
        'dir4',
        'vpai001',
        'dir2',
        'vpai001' ])
**/    
      done()
    }) 

    it("move alonzo in root into dir2, 2a47f5ac", function (done) {
      this.timeout(0)
      let homeAlonzoUUID = home.entries.find(x => x.name === alonzo.name).uuid
      request(app) 
        .post(`/tasks`)
        .set('Authorization', 'JWT ' + token)
        .send({
          type: 'move',
          src: {
            drive: IDS.alice.home,
            dir: IDS.alice.home
          },
          dst: {
            drive: IDS.alice.home,
            dir: dir2UUID
          },
          entries: [
            homeAlonzoUUID
          ] 
        })
        .expect(200)
        .end((err, res) => {
          debug(res.body)
          let taskId = res.body.uuid
          let polling = setInterval(() => {
            request(app)
              .get(`/tasks/${taskId}`)
              .set('Authorization', 'JWT ' + token)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  clearInterval(polling)
                  return done(err)
                } 
                debug(res.body)

                if (res.body.isStopped) {
                  clearInterval(polling)

                  console.log(res.body)

                  let dstPath = path.join(driveDir, IDS.alice.home, 'dir2', FILES.alonzo.name)
                  fingerprint(dstPath, (err, hash) => {
                    if (err) return done(err)
                    expect(hash).to.equal(FILES.alonzo.hash)
                    done()
                  })                   
                }
              })
          }, 1000)
        })
    }) 

    it("move dir1 into dir2, 3b7307ba", function (done) {
      this.timeout(0)
      request(app) 
        .post(`/tasks`)
        .set('Authorization', 'JWT ' + token)
        .send({
          type: 'move',
          src: {
            drive: IDS.alice.home,
            dir: IDS.alice.home,
          },
          dst: {
            drive: IDS.alice.home,
            dir: dir2UUID
          },
          entries: [
            dir1UUID
          ]
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)  
          debug(res.body) 
          console.log(res.body)
          let taskId = res.body.uuid
          let polling = setInterval(() => {
            request(app)
              .get(`/tasks/${taskId}`)
              .set('Authorization', 'JWT ' + token)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  clearInterval(polling)
                  return done(err)
                } 
                debug(res.body)
                if (res.body.isStopped) {
                  clearInterval(polling)
                  done()
                } 
              })
          }, 1000)
        })
    })

  }) 
})

