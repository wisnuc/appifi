import path from 'path'
import { mkdirpAsync, rimrafAsync, fs } from 'src/fruitmix/util/async'
import { expect } from 'chai'
import request from 'supertest'

import app from 'src/fruitmix/app'
import paths from 'src/fruitmix/lib/paths'
import models from 'src/fruitmix/models/models'
import { createUserModelAsync } from 'src/fruitmix/models/userModel'
import { createDriveModelAsync } from 'src/fruitmix/models/driveModel'
import { createFiler } from 'src/fruitmix/lib/filer'
import { createRepo } from 'src/fruitmix/lib/repo'

let userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
let drv001UUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
let drv002UUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 

let users = [
  {
    type: 'local',
    uuid: userUUID,
    username: 'hello',
    password: '$2a$10$0kJAT..tF9IihAc6GZfKleZQYBGBHSovhZp5d/DiStQUjpSMnz8CC',
    smbUsername: null,
    smbPassword: null,
    smbLastChangeTime: null,

    avatar: null,
    email: null,

    isFirstUser: true,
    isAdmin: true,

    home: drv001UUID,
    library: drv002UUID
  }
]

let drives = [
  {
    label: 'drv001',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: drv001UUID,
    owner: [ userUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'drv002',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: drv002UUID,
    owner: [ userUUID ],
    writelist: [],
    readlist: [],
    cache: true
  }
]

const requestToken = (callback) => {

  request(app)
    .get('/token')
    .auth(userUUID, 'world')
    .set('Accept', 'application/json')
    .end((err, res) => 
      err ? callback(err) : callback(null, res.body.token))
}

const requestTokenAsync = Promise.promisify(requestToken)

const createRepoCached = (model, callback) => {
  
  let err
  let repo = createRepo(model) 
  
  // if no err, return repo after driveCached
  repo.filer.on('collationsStopped', () => !err && callback(null, repo))
  // init & if err return err
  repo.init(e => e && callback(err = e))
}

const prepare = (callback) => {


  (async () => {

    // make test dir
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    // set path root
    await paths.setRootAsync(path.join(process.cwd(), 'tmptest'))

    // fake drive dir
    let dir = paths.get('drives')
    await mkdirpAsync(path.join(dir, drv001UUID))
    await mkdirpAsync(path.join(dir, drv002UUID))
    
    // write model files
    dir = paths.get('models')
    let tmpdir = paths.get('tmp')
    await fs.writeFileAsync(path.join(dir, 'users.json'), JSON.stringify(users, null, '  '))
    await fs.writeFileAsync(path.join(dir, 'drives.json'), JSON.stringify(drives, null, '  '))

    // create models
    let umod = await createUserModelAsync(path.join(dir, 'users.json'), tmpdir)
    let dmod = await createDriveModelAsync(path.join(dir, 'drives.json'), tmpdir)

    // set models
    models.setModel('user', umod)
    models.setModel('drive', dmod)

    // create repo and wait until drives cached
    let repo = await createRepoCachedAsync(dmod)
    models.setModel('filer', repo.filer)
    models.setModel('repo', repo)

    // request a token for later use
    return await requestTokenAsync()

  })().asCallback(callback)
}

const createRepoCachedAsync = Promise.promisify(createRepoCached)

describe(path.basename(__filename) + ': test repo', function() {

  describe('GET /users', () => {

    let token

    beforeEach(function(done) {
      prepare((err, tok) => {
        if (err) return done(err)
        token = tok
        done()
      })      
    })

    it('should return 401 unauthorized if no token', (done) => {
      request(app)
        .get('/users')
        .set('Accept', 'application/json')
        .expect(401)
        .end((err, res) => { 
           if(err) return done(err);
           done();
         })
    })

    /* 
    it('return empty set when no user exists', (done) => {
      request(app)
        .get('/users')
        .set('Authorization', 'JWT ' + token)
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, res) => { 
           if(err) return done(err);
           expect(res.body).to.deep.equal([]);
           done();
         })
    })
    */

    it('return given [user]', (done) => {
/**
[ { type: 'local',
    uuid: '9f93db43-02e6-4b26-8fae-7d6f51da12af',
    username: 'hello',
    smbUsername: null,
    avatar: null,
    email: null,
    isFirstUser: true,
    isAdmin: true,
    home: 'ceacf710-a414-4b95-be5e-748d73774fc4',
    library: '6586789e-4a2c-4159-b3da-903ae7f10c2a' } ]
**/
      request(app)
        .get('/users')
        .set('Authorization', 'JWT ' + token)
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, res) => { 
          if (err) return done(err);
          let userList = res.body
          expect(userList.length === 1)
          let user = userList[0]

          expect(user.type).to.equal('local')
          expect(user.uuid).to.equal(userUUID)
          expect(user.username).to.equal('hello')
          expect(user.smbUsername).to.be.null 
          expect(user.avatar).to.be.null
          expect(user.email).to.be.null
          expect(user.isAdmin).to.be.true
          expect(user.isFirstUser).to.be.true
          expect(user.home).to.equal(drv001UUID)
          expect(user.library).to.equal(drv002UUID)

          done();
        })
    })
  })

  describe('POST /users', () => {

    let token
    beforeEach(function(done) {
      prepare((err, tok) => {
        if (err) return done(err)
        token = tok
        done()
      })      
    })

    it('should add Jason', function(done) {

      request(app)
        .post('/users/')
        .set('Authorization', 'JWT ' + token) 
        .set('Accept', 'application/json')
        .send({
          username: 'Jason', 
          password: 'Bourne'
        })
        .expect(200)
        .end(function(err, res) {
          let user = res.body  
          expect(user.username).to.equal('Jason')
          done()
        })
    })
  })

  describe('PATCH /users', () => {

    let token
    let userUUID

    beforeEach(function(done) {

      prepare((err, tok) => {
        if (err) return done(err)
        token = tok

        request(app)
          .post('/users/')
          .set('Authorization', 'JWT ' + token)
          .set('Accept', 'application/json')
          .send({
            username: 'Jason',
            password: 'Bourne'
          })
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            userUUID = res.body.uuid
            done()
          })
      })
    })

    it('should change Jason to Jupiter', function(done) {
      
      request(app)
        .patch(`/users/${userUUID}`)
        .set('Authorization', 'JWT ' + token)
        .set('Accept', 'application/json')
        .send({
          username: 'Jupiter'
        })
        .expect(200, done)
    })
  })

  describe('DELETE /users/:userUUID', () => {

    let token

    beforeEach(done => 
      prepare((err, tok) => {
        if (err) return done(err)
        token = tok
        done()
      }))

    // it('should 
  })
  
  
  /*
  describe('POST /users', () => {
    
    beforeEach((done) => {
      UserModel.data.createUser(createData)
      .then(()=>done())
    })

    it('successfully add a user', (done) => {
      let f2;
      request(app)
        .post('/users')
        .set('Accept', 'application/json')
        .send({'username':'u2', 'email':'bbb@ccc.com', 'password':'111111'})
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          f2() 
        })
      f2=() => {
        request(app)
          .get('/users')
          .set('Accept', 'application/json')
          .expect(200)
          .end((err, res) => { 
             if(err) return done(err);
             expect(res.body).to.deep.equal([{'avatar':'', 'email':'aaa@bbb.com', 'username':'u1', 'uuid':UserModel.data.collection.list[0].uuid}, {'avatar':'', 'email':'bbb@ccc.com', 'username':'u2', 'uuid':UserModel.data.collection.list[1].uuid}]);
             done();
           })
      }
    })
  })

  
  describe('DELETE /users', () => {
    
    let createData2={username:"u2", "password":"111111", "avatar":"", "email":"bbb@ccc.com", "isAdmin":false, "type":""}  
    
    beforeEach((done) => {
      UserModel.data.createUser(createData)
      .then(()=> UserModel.data.createUser(createData2))
      .then(()=>done())
    })


    it('successfully delete a user', (done) => {
      let f2;
      request(app)
        .delete('/users')
        .set('Accept', 'application/json')
        .send({'uuid':UserModel.data.collection.list[1].uuid})
        .expect(200)
        .end((err, res) => {
          if(err) return done(err)
          f2() 
        })
      f2=() => {
        request(app)
          .get('/users')
          .set('Accept', 'application/json')
          .expect(200)
          .end((err, res) => { 
             if(err) return done(err);
             expect(res.body).to.deep.equal([{'avatar':'', 'email':'aaa@bbb.com', 'username':'u1', 'uuid':UserModel.data.collection.list[0].uuid}]);
             done();
           })
      }
    })
  })
*/
})

