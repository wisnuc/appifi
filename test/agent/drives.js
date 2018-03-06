const Promise = require('bluebird')
const path = require('path')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const {
  IDS,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync
} = require('./lib')

const app = require('src/app')
const broadcast = require('src/common/broadcast')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(cwd, 'tmp')

const resetAsync = async () => {
  broadcast.emit('FruitmixStop')
  await rimrafAsync(tmptest)
  await mkdirpAsync(tmpDir)
  broadcast.emit('FruitmixStart', tmptest) 
  await broadcast.until('FruitmixStarted')
}


describe(path.basename(__filename) + ', Alice only', () => {

  let token

  beforeEach(async () => {
    await resetAsync()
    await createUserAsync('alice')
    token = await retrieveTokenAsync('alice')
  })

  const getBuiltInDrive = (token, callback) => 
    request(app)
      .get('/drives')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        let bid = res.body.find(drv => drv.type === 'public' && drv.tag === 'built-in')
        callback(null, bid)
      })

  it('Get Drive List, 16d56af0', done => {
    request(app)
      .get('/drives')      
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let pubs = res.body.filter(d => d.type === 'public')
        let privs = res.body.filter(d => d.type === 'private')

        expect(pubs).to.deep.equal([{
          uuid: pubs[0].uuid,
          type: 'public',
          writelist: '*',
          readlist: '*',
          label: '',
          tag: 'built-in'
        }])

        expect(privs).to.deep.equal([{ 
          uuid: IDS.alice.home,
          type: 'private',
          owner: IDS.alice.uuid,
          tag: 'home'
        }])
        done()
      })
  })

  it('Create Public Drive, writelist [alice]', done => {
    request(app)
      .post('/drives')
      .send({ writelist: [IDS.alice.uuid], label: 'foobar' })
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body).to.deep.equal({
          uuid: res.body.uuid,
          type: 'public',
          writelist: [IDS.alice.uuid],
          readlist: [],
          label: 'foobar'
        })

        done()
      })
  }) 

  it('Create Public Drive, writelist *', done => {
    request(app)
      .post('/drives')
      .send({ writelist: [IDS.alice.uuid], label: 'foobar' })
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body).to.deep.equal({
          uuid: res.body.uuid,
          type: 'public',
          writelist: [IDS.alice.uuid],
          readlist: [],
          label: 'foobar'
        })
        done()
      })
  }) 

  it('Get Drive, home, 3c14a0b2', done => {
    request(app)
      .get(`/drives/${IDS.alice.home}`)
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        expect(res.body).to.deep.equal({
          uuid: IDS.alice.home,
          type: 'private',
          owner: IDS.alice.uuid,
          tag: 'home'
        })
        done()
      })
  })

  it('Get Drive, built-in, 1973adf5', done => {
    request(app)
      .get('/drives')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        let bid = res.body.find(drv => drv.type === 'public' && drv.tag === 'built-in')
        expect(bid).to.be.an('object')

        request(app)
          .get(`/drives/${bid.uuid}`)
          .set('Authorization', 'JWT ' + token)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body).to.deep.equal(bid)
            done()
          })
      })
  }) 

  it('Patch Private Drive should fail with 403', done => {
    patchPublicDrive(token, IDS.alice.home, {}, 403, done)
  })

  const createPublicDrive = (token, uuid, body, callback) => {
    sinon.stub(UUID, 'v4').returns(uuid)      
    request(app)
      .post('/drives')
      .set('Authorization', 'JWT ' + token)
      .send(body)
      .expect(200)
      .end((err, res) => {
        UUID.v4.restore() 
        if (err) {
          callback(err)
        } else {
          callback(null, res.body)
        }
      })
  }

  const patchPublicDrive = (token, driveUUID, body, code, callback) => 
    request(app)
      .patch(`/drives/${driveUUID}`)
      .set('Authorization', 'JWT ' + token)
      .send(body)
      .expect(code)
      .end((err, res) => callback && callback(err, res)) 


  it('Patch A Public Drive, with invalid prop should fail with 400', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => err 
      ? done(err) 
      : patchPublicDrive(token, IDS.publicDrive1.uuid, { hello: 'world' }, 400, done))
  })

  it('Patch A Public Drive, change uuid should fail with 400', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => {
      if (err) return done(err)
      let body = { uuid: '9c7d2912-307f-4bad-a1eb-87e60345f551' }
      patchPublicDrive(token, IDS.publicDrive1.uuid, body, 403, done) 
    })
  }) 

  it('Patch A Public Drive, change type should fail with 403', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => {
      if (err) return done(err)
      let body = { type: 'private' }
      patchPublicDrive(token, IDS.publicDrive1.uuid, body, 403, done) 
    })
  }) 

  it('Patch A Public Drive, change readlist should fail with 403', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => {
      if (err) return done(err)
      let body = { readlist: [] }
      patchPublicDrive(token, IDS.publicDrive1.uuid, body, 403, done) 
    })
  }) 

  it('Patch A Public Drive, change label should succeed', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => {
      if (err) return done(err)
      let body = { label: 'whatever' }
      patchPublicDrive(token, IDS.publicDrive1.uuid, body, 200, (err, res) => {
        if (err) return done(err)
        expect(res.body).to.deep.equal({
          uuid: IDS.publicDrive1.uuid,
          type: 'public',
          writelist: [IDS.alice.uuid],
          readlist: [],
          label: 'whatever'
        })
        done()
      }) 
    })
  }) 

  it('Patch A Public Drive, change writelist to hello should fail with 400, 5fd5987c', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => {
      if (err) return done(err)
      let body = { writelist: 'hello' }
      patchPublicDrive(token, IDS.publicDrive1.uuid, body, 400, done) 
    })
  }) 

  it('Patch A Public Drive, change writelist to invalid uuid user array should fail with 400', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => {
      if (err) return done(err)
      let body = { writelist: ['39c70142-04cb-49de-b8e0-ab50810e19cb'] }
      patchPublicDrive(token, IDS.publicDrive1.uuid, body, 400, done) 
    })
  })

  it('Patch A Public Drive, change writelist to empty array should succeed', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => {
      if (err) return done(err)
      let body = { writelist: [] }
      patchPublicDrive(token, IDS.publicDrive1.uuid, body, 200, (err, res) => {
        if (err) return done(err)
        expect(res.body).to.deep.equal({
          uuid: IDS.publicDrive1.uuid,
          type: 'public',
          writelist: [],
          readlist: [],
          label: 'foobar'
        })
        done()
      }) 
    })
  })

  it('Patch A Public Drive, change writelist to wildcard should succeed', done => {
    let foobar = { writelist: [IDS.alice.uuid], label: 'foobar' }
    createPublicDrive(token, IDS.publicDrive1.uuid, foobar, (err, drive) => {
      if (err) return done(err)
      let body = { writelist: '*' }
      patchPublicDrive(token, IDS.publicDrive1.uuid, body, 200, (err, res) => {
        if (err) return done(err)
        expect(res.body).to.deep.equal({
          uuid: IDS.publicDrive1.uuid,
          type: 'public',
          writelist: '*',
          readlist: [],
          label: 'foobar'
        })
        done()
      }) 
    })
  })

  it('Patch built-in drive, update writelist should fail with 400, 9d31ac96', done => {
    getBuiltInDrive(token, (err, drive) => {
      if (err) return done(err)
      let body = { writelist: [IDS.alice.uuid] }
      patchPublicDrive(token, drive.uuid, body, 400, done)
    })
  }) 

  it('Patch built-in drive, update tag should fail with 400, 42a99fd3', done => {
    getBuiltInDrive(token, (err, drive) => {
      if (err) return done(err)
      let body = { tag: 'hello' }
      patchPublicDrive(token, drive.uuid, body, 400, done)
    })
  }) 

  it('Patch built-in drive, update label should succeed, a49c188f', done => {
    getBuiltInDrive(token, (err, drive) => {
      if (err) return done(err)
      let body = { tag: 'hello' }
      patchPublicDrive(token, drive.uuid, body, 400, done)
    })
  }) 

})
