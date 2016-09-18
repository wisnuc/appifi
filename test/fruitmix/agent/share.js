import path from 'path'
import crypto from 'crypto'

import Promise from 'bluebird'
import xattr from 'fs-xattr'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiAsPromised)

const expect = chai.expect
const should = chai.should()

import app from 'src/fruitmix/app'
import paths from 'src/fruitmix/lib/paths'
import models from 'src/fruitmix/models/models'
import { createUserModelAsync } from 'src/fruitmix/models/userModel'
import { createDriveModelAsync } from 'src/fruitmix/models/driveModel'
import { createDrive } from 'src/fruitmix/lib/drive'
import { createRepo } from 'src/fruitmix/lib/repo'

import request from 'supertest'
import { mkdirpAsync, rimrafAsync, fs } from 'test/fruitmix/unit/util/async'

import validator from 'validator'

let aliceUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
let bobUUID = '12f25343-8b9e-45f8-9487-9d56c2898648' 

let aliceHomeUUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
let aliceLibUUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 
let bobHomeUUID = 'ed56919e-aeeb-428f-8600-12f3554ef09c' 
let bobLibUUID = 'd3975e2c-3640-46d6-96e0-788157a1a203'

const file001UUID = 'a02adf06-660d-4bf7-a3e6-b9539c2ec6d2'
let file001Timestamp

let users = [
  {
    uuid: aliceUUID,
    username: 'hello',
    password: '$2a$10$0kJAT..tF9IihAc6GZfKleZQYBGBHSovhZp5d/DiStQUjpSMnz8CC',

    smbUsername: null,
    smbPassword: null,
    smbLastChangeTime: null,

    avatar: null,
    email: null,

    isAdmin: true,
    isFirstUser: true,

    home: aliceHomeUUID,
    library: aliceLibUUID
  },
  {
    uuid: bobUUID,
    username: 'jason',
    password: '$2a$10$0kJAT..tF9IihAc6GZfKleZQYBGBHSovhZp5d/DiStQUjpSMnz8CC',
    smbUsername: null,
    smbPassword: null,
    smbLastChangeTime: null,

    avatar: null,
    email: null,

    isAdmin: false,
    isFirstUser: false,

    home: bobHomeUUID,
    library: bobLibUUID
  }
]

let drives = [
  {
    label: 'alice home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: aliceHomeUUID,
    owner: [ aliceUUID ],
    writelist: [bobUUID],
    readlist: [],
    cache: true
  },
  {
    label: 'alice lib',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: aliceLibUUID,
    owner: [ aliceUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'bob home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: bobHomeUUID,
    owner: [ bobUUID ],
    writelist: [],
    readlist: [aliceUUID],
    cache: true
  },
  {
    label: 'bob lib',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: bobLibUUID,
    owner: [ bobUUID ],
    writelist: [],
    readlist: [],
    cache: true
  }
]

const requestToken = (userUUID, callback) => {

  request(app)
    .get('/token')
    .auth(userUUID, 'world')
    .set('Accept', 'application/json')
    .end((err, res) => 
      err ? callback(err) : callback(null, res.body.token))
}

const requestTokenAsync = Promise.promisify(requestToken)

const createRepoCached = (paths, model, forest, callback) => {
  
  let err
  let repo = createRepo(paths, model, forest) 
  
  // if no err, return repo after driveCached
  repo.on('driveCached', () => !err && callback(null, repo))
  // init & if err return err
  repo.init(e => e && callback(err = e))
}

const createRepoCachedAsync = Promise.promisify(createRepoCached)

const prepare = (callback) => {


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

    //
    let forest = createDrive()
    models.setModel('forest', forest)    

    // create repo and wait until drives cached
    let repo = await createRepoCachedAsync(paths, dmod, forest)
    models.setModel('repo', repo)

    // request a token for later use
    let alice = await requestTokenAsync(aliceUUID)
    let bob = await requestTokenAsync(bobUUID)

    return { alice, bob }

  })().asCallback(callback)
}

describe(path.basename(__filename), function() {


  const swm = (token, callback) => 
    request(app)
      .get('/share/sharedWithMe')
      .set('Authorization', 'JWT ' + token)
      .set('Accept', 'application/json')
      .expect(200)
      .end((err, res) => 
        err ? callback(err) : callback(null, res.body))

  const swmAsync = Promise.promisify(swm)

  const swo = (token, callback) => 
    request(app)
      .get('/share/sharedWithOthers')
      .set('Authorization', 'JWT ' + token)
      .set('Accept', 'application/json')
      .expect(200)
      .end((err, res) => 
        err ? callback(err) : callback(null, res.body))

  const swoAsync = Promise.promisify(swo)

  describe('alice GET sharedWithMe', function() {

    let nullify = () => null
    let tokens
    beforeEach(done => prepare((err, toks) => 
        err ? done(err) : done(nullify(tokens = toks))))

    it('alice SWM should have one item', () => 
      swmAsync(tokens.alice).should.eventually.have.property('length', 1))

    it('alice SWM should include bob home drive', () => 
      swmAsync(tokens.alice).should.eventually.satisfy(list => 
        list.find(item => item.uuid === bobHomeUUID)))
  })

  describe('alice GET sharedWithOthers', function() {

    let nullify = () => null
    let tokens

    beforeEach(done => prepare((err, toks) => 
        err ? done(err) : done(nullify(tokens = toks))))

    it('alice SWO should have two items', () =>
      swoAsync(tokens.alice).should.eventually.have.property('length', 2)) 

    it('alice SWO should include alice home drive', () => 
      swoAsync(tokens.alice).should.eventually.satisfy(list => 
        list.find(item => item.uuid === aliceHomeUUID)))

    it('alice SWO should include alice lib drive', () => 
      swoAsync(tokens.alice).should.eventually.satisfy(list => 
        list.find(item => item.uuid === aliceLibUUID)))
  })
})

