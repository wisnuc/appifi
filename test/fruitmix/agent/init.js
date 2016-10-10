import path from 'path'
import { mkdirpAsync, rimrafAsync, fs } from 'src/fruitmix/util/async'
import { expect } from 'chai'
import request from 'supertest'

import app from 'src/fruitmix/app'
import paths from 'src/fruitmix/lib/paths'
import models from 'src/fruitmix/models/models'
import { createUserModelAsync } from 'src/fruitmix/models/userModel'
import { createDriveModelAsync } from 'src/fruitmix/models/driveModel'
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

const createRepoCached = (model, callback) => {
  
  let finished = false
  let repo = createRepo(model) 
  
  // if no err, return repo after driveCached
  repo.filer.on('collationsStopped', () => !finished && callback(null, repo))
  // init & if err return err
  repo.init(err => {

    if (err) {
      finished = true
      return callback(err)
    }
    if (repo.filer.roots.length === 0)
      callback(null, repo)
  })
}

const createRepoCachedAsync = Promise.promisify(createRepoCached)

const prepare = (users, drives, callback) => {

  (async () => {

    // make test dir
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    // set path root
    await paths.setRootAsync(path.join(process.cwd(), 'tmptest'))

    // fake drive dir
    let dir = paths.get('drives')
    if (drives.length) {
      await Promise.all(drives.map(drv => 
        mkdirpAsync(path.join(dir, drv.uuid))))
    }

    // write model files
    dir = paths.get('models')
    let tmpdir = paths.get('tmp')
    if (users.length) {
      await fs.writeFileAsync(path.join(dir, 'users.json'), JSON.stringify(users, null, '  '))
    }
    if (drives.length) {
      await fs.writeFileAsync(path.join(dir, 'drives.json'), JSON.stringify(drives, null, '  '))
    }

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

  })().asCallback(callback)
}


describe(path.basename(__filename), function() {

  describe('test init when no user exists (first time)', function() {

    beforeEach(function(done) {
      prepare([], [], done)
    })
    
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
   
    beforeEach(function(done) {
      prepare(users, drives, done)
    })

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

