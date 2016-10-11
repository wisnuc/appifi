import path from 'path'
import crypto from 'crypto'

import xattr from 'fs-xattr' // TODO

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiAsPromised)

const expect = chai.expect
const should = chai.should()

import app from 'src/fruitmix/app'

import { fakePathModel, fakeRepoSilenced, requestTokenAsync } from 'src/fruitmix/util/fake'

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

const prepare = (callback) => {

  (async () => {

    await fakePathModel(path.join(process.cwd(), 'tmptest'), users, drives)
    await fakeRepoSilenced()

    // request a token for later use
    let alice = await requestTokenAsync(app, aliceUUID, 'world')
    let bob = await requestTokenAsync(app, bobUUID, 'world')

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

