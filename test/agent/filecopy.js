const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const request = require('supertest')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const debug = require('debug')('divider')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const broadcast = require('src/common/broadcast')
const app = require('src/app')
const getFruit = require('src/fruitmix')

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
  r.expect(200).end(callback)
}

describe(path.basename(__filename), () => {

  describe("Alice copy this to that", () => {

    let { alonzo, bar, empty, foo, hello, vpai001, world } = FILES
    let dir1UUID, dir2UUID, dir3UUID, dir4UUID
    let homeEntries, dir1Entries, dir3Entries  
    
    let token
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

      // console.log(homeEntries, dir1Entries, dir3Entries)
    })

    it("create task, copy home alonzo to dir2", done => {
      let { alonzo, bar, empty, foo, hello, vpai001, world } = FILES
      let homeAlonzoUUID = home.entries.find(x => x.name === alonzo.name).uuid
      request(app)
        .post(`/tasks`)
        .set('Authorization', 'JWT ' + token)
        .send({ 
          type: 'copy',
          src: {
            drive: IDS.alice.home,
            dir: IDS.alice.home
          },
          dst: {
            drive: IDS.alice.home,
            dir: dir2UUID,
          },
          entries: [ homeAlonzoUUID ]
        })
        .expect(200)
        .end((err, res) => {

          let { uuid, user, type, src, dst, entries } = res.body
          expect({ user, type, src, dst }).to.deep.equal({
            user: IDS.alice.uuid,
            type: 'copy',
            src: {
              drive: IDS.alice.home,
              dir: IDS.alice.home,
            },
            dst: {
              drive: IDS.alice.home,
              dir: dir2UUID
            },
          })
          done()
        })
    })

    it("create task, copy home alonzo to dir2, get tasks", function (done) {
      this.timeout(5000)

      let { alonzo, bar, empty, foo, hello, vpai001, world } = FILES
      let homeAlonzoUUID = home.entries.find(x => x.name === alonzo.name).uuid
      request(app)
        .post(`/tasks`)
        .set('Authorization', 'JWT ' + token)
        .send({ 
          type: 'copy',
          src: {
            drive: IDS.alice.home,
            dir: IDS.alice.home
          },
          dst: {
            drive: IDS.alice.home,
            dir: dir2UUID,
          },
          entries: [ homeAlonzoUUID ]
        })
        .expect(200)
        .end((err, res) => {

          request(app)
            .get(`/tasks`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              expect(res.body).to.be.an('array')
              expect(res.body.length).to.equal(1)

              let { uuid, user, type, src, dst, entries } = res.body[0]
              expect({ user, type, src, dst }).to.deep.equal({
                user: IDS.alice.uuid,
                type: 'copy',
                src: {
                  drive: IDS.alice.home,
                  dir: IDS.alice.home,
                },
                dst: {
                  drive: IDS.alice.home,
                  dir: dir2UUID
                },
              })

              done()
            })
              
        })
    })

    it("create task, copy home alonzo to dir2, wait and get tasks", function (done) {
      this.timeout(5000)

      let { alonzo, bar, empty, foo, hello, vpai001, world } = FILES
      let homeAlonzoUUID = home.entries.find(x => x.name === alonzo.name).uuid
      request(app)
        .post(`/tasks`)
        .set('Authorization', 'JWT ' + token)
        .send({ 
          type: 'copy',
          src: {
            drive: IDS.alice.home,
            dir: IDS.alice.home
          },
          dst: {
            drive: IDS.alice.home,
            dir: dir2UUID,
          },
          entries: [ homeAlonzoUUID, dir1UUID ]
        })
        .expect(200)
        .end((err, res) => {

          setTimeout(() => request(app)
            .get(`/tasks`)
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              expect(res.body).to.be.an('array')
              expect(res.body.length).to.equal(1)

              let { uuid, user, type, src, dst, entries } = res.body[0]
              expect({ user, type, src, dst }).to.deep.equal({
                user: IDS.alice.uuid,
                type: 'copy',
                src: {
                  drive: IDS.alice.home,
                  dir: IDS.alice.home,
                },
                dst: {
                  drive: IDS.alice.home,
                  dir: dir2UUID
                },
              })

              done()

            }), 2000)
              
        })
    })
  })
})


