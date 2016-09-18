import path from 'path'
import Promise from 'bluebird'

import { expect } from 'chai'

import app from 'src/fruitmix/app'
import paths from 'src/fruitmix/lib/paths'
import models from 'src/fruitmix/models/models'
import { createUserModelAsync } from 'src/fruitmix/models/userModel'
import { createDriveModelAsync } from 'src/fruitmix/models/driveModel'
import { createDrive } from 'src/fruitmix/lib/drive'
import { createRepo } from 'src/fruitmix/lib/repo'

import request from 'supertest'
import { mkdirpAsync, rimrafAsync, fs } from 'src/fruitmix/util/async'

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

const requestToken = (callback) => {

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

describe(path.basename(__filename) + ': test repo', function() {

  describe('test drives api', function() {
  
    let token
    let cwd = process.cwd()

    beforeEach(function() {
      return (async () => {

        // make test dir
        await rimrafAsync('tmptest')
        await mkdirpAsync('tmptest')

        // set path root
        await paths.setRootAsync(path.join(cwd, 'tmptest'))

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

        //
        let forest = createDrive()
        models.setModel('forest', forest)    

        // create repo and wait until drives cached
        let repo = await createRepoCachedAsync(paths, dmod, forest)
        models.setModel('repo', repo)

        // request a token for later use
        token = await requestTokenAsync()
        // console.log(token)
      })()     
    })

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

  beforeEach(function() {
    return (async () => {
      await initFamilyRoot(path.join(process.cwd(), 'family'))

      let forest = createDrive()
      models.setModel('forest', forest)
      await Promise.promisify(createRepoCached)(paths, models.getModel('drive'), forest)
    })()
  })
  
  it('demo alice drive', function() {
        
  })
})

