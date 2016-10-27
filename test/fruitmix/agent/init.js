import path from 'path'
import { expect } from 'chai'
import request from 'supertest'

import { fakePathModel, fakeRepoSilenced } from 'src/fruitmix/util/fake'
import app from 'src/fruitmix/app'

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

describe(path.basename(__filename), function() {

  describe('test init when no user exists (first time)', function() {

    beforeEach(() => (async () => {
      await fakePathModel(path.join(process.cwd(), 'tmptest'), [], [])
      await fakeRepoSilenced()
    })())

    it('GET /init should 404', function(done) {
      request(app)
        .get('/init')
        .set('Accept', 'application/json')
        .expect(404, done)
    })

    it('POST /init without username should fail with 400', function(done) {
      request(app)
        .post('/init')
        .send({ password: 'world' })
        .set('Accept', 'application/json')
        .expect(400, done) 
    })

    it('POST /init without password should fail with 400', function(done) {
      request(app)
        .post('/init')
        .send({ username: 'hello'})
        .set('Accept', 'application/json')
        .expect(400, done)
    })

    it('POST /init with username / password should success', function(done) {
      request(app)
        .post('/init')
        .send({ username: 'hello', password: 'world' })
        .set('Accept', 'application/json')
        .expect(200, done)
    })
  })

  describe('test init when user exists', function() {
   
    beforeEach(() => (async () => {
      await fakePathModel(path.join(process.cwd(), 'tmptest'), users, drives)
      await fakeRepoSilenced()
    })())

    it('GET /init should 404', function(done){
      request(app)
        .get('/init')
        .set('Accept', 'application/json')
        .expect(404, done) 
    })

    it('POST /init should fail with 404', function(done){
      request(app)
        .post('/init')
        .set('Accept', 'application/json')
        .send({ username: 'hello', password: 'world' })
        .expect(404, done)
    })
  })

})

