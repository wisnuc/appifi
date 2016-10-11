import path from 'path'
import { mkdirpAsync, rimrafAsync, fs } from 'src/fruitmix/util/async'

import { expect } from 'chai'

import app from 'src/fruitmix/app'

import { fakePathModel, fakeRepoSilenced, requestTokenAsync } from 'src/fruitmix/util/fake'

import request from 'supertest'
import { initFamilyRoot, genUserToken } from 'src/fruitmix/util/family'

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

describe(path.basename(__filename) + ': test repo', function() {

  describe('test drives api', function() {
  
    let token
    let cwd = process.cwd()

    beforeEach(() => (async () => {
      await fakePathModel(path.join(cwd, 'tmptest'), users, drives)
      await fakeRepoSilenced()
      token = await requestTokenAsync(app, userUUID, 'world')
    })())

    it('GET /drives returns predefined drive info', function(done) {
      request(app)
        .get('/drives')
        .set('Authorization', 'JWT ' + token)
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err)          
          let arr = res.body.sort((a, b) => a.label.localeCompare(b.label))
          expect(arr).to.deep.equal(drives) 
          done()
        })
    })
  })
})

describe(path.basename(__filename) + ': family version', function() {

  beforeEach(() => (async () => {
    await initFamilyRoot(path.join(process.cwd(), 'family'))
    // TODO await createRepoCachedAsync(models.getModel('drive'))
  })())

  it('demo alice drive (todo)', function() {
        
  })
})

