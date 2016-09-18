import path from 'path'
import crypto from 'crypto'

import Promise from 'bluebird'

import { expect } from 'chai'

import app from 'src/fruitmix/app'
import paths from 'src/fruitmix/lib/paths'
import models from 'src/fruitmix/models/models'

import { createUserModelAsync } from 'src/fruitmix/models/userModel'
import { createDriveModelAsync } from 'src/fruitmix/models/driveModel'

import createUUIDLog from 'src/fruitmix/lib/uuidlog'
import { createDrive } from 'src/fruitmix/lib/drive'
import { createRepo } from 'src/fruitmix/lib/repo'

import request from 'supertest'
import { mkdirpAsync, rimrafAsync, fs } from 'test/fruitmix/unit/util/async'
import xattr from 'fs-xattr'
import validator from 'validator'

let userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
let drv001UUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
let drv002UUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 
const file001UUID = 'a02adf06-660d-4bf7-a3e6-b9539c2ec6d2'
let file001Timestamp

const libNameUUID = 'f814e15b-224f-4ffd-ac7b-674109801df9'
const libUUID = '4a6aa375-61ab-46fa-80c9-7e34307d7d03'
const sha256Of20141213 = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'

let users = [
  {
    uuid: userUUID,
    username: 'hello',
    password: '$2a$10$0kJAT..tF9IihAc6GZfKleZQYBGBHSovhZp5d/DiStQUjpSMnz8CC',
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
    .end((err, res) => err ? callback(err) : callback(null, res.body.token))
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

  describe('test files api', function() {
  
    let token
    let cwd = process.cwd()
    let repo
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
        let libpath = path.join(dir, drv002UUID, libNameUUID)
        await mkdirpAsync(libpath) 
        await Promise.promisify(xattr.set)(libpath, 'user.fruitmix', JSON.stringify({
          uuid: libUUID,
          owner: [userUUID],
        }))

        
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

        let logpath = paths.get('log')
        let uuidlog = createUUIDLog(logpath)
        models.setModel('log', uuidlog)

        let forest = createDrive()
        models.setModel('forest', forest)

        // create repo and wait until drives cached
        repo = await createRepoCachedAsync(paths, dmod, forest)
        models.setModel('repo', repo)

        // request a token for later use
        token = await requestTokenAsync()
        // console.log(token)
      })()     
    })

    afterEach(function() {
      repo.deinit()
    })

    it('GET /libraries should return library list', function(done) {
      
      request(app)
        .get(`/libraries`)
        .set('Authorization', 'JWT ' + token)
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body).to.deep.equal([libUUID])
          done()
        })
    })

    it('POST /libraries should return a new library uuid (need sinon)', function(done) {
  
      request(app)
        .post(`/libraries`)
        .set('Authorization', 'JWT ' + token)
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          console.log(res.body)
          done()
        })
    })

    it('POST /libraries/:libUUID return {digest, ctime}', function(done) {
      
      request(app)
        .post(`/libraries/${libUUID}`)
        .set('Authorization', 'JWT ' + token) 
        .set('Accept', 'application/json')
        .attach('file', 'fruitfiles/20141213.jpg')
        .field('sha256', sha256Of20141213)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.digest).to.equal(sha256Of20141213)
          expect(Number.isInteger(res.body.ctime)).to.be.true 
          done() 
        })
    })

    it('POST /libraries/:libUUID create the same file in lib', function(done) {

      function hashFile(fpath, callback) {

        let abort = false
        let hash = crypto.createHash('sha256')
        hash.setEncoding('hex')
        let is = fs.createReadStream(fpath)
        is.on('error', err => {
          abort = true
          callback(err)
        })

        is.on('end', () => {
          if (abort) return
          hash.end()
          callback(null, hash.read())
        })  

        is.pipe(hash) 
      }

      request(app)
        .post(`/libraries/${libUUID}`)
        .set('Authorization', 'JWT ' + token) 
        .set('Accept', 'application/json')
        .attach('file', 'fruitfiles/20141213.jpg')
        .field('sha256', sha256Of20141213)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let filepath = path.join(cwd, 'tmptest', 'drives', drv002UUID, libNameUUID, sha256Of20141213)
          hashFile(filepath, (err, hash) => {
            if (err) return done(err)
            expect(hash).to.equal(sha256Of20141213)
            done()
          })
        })
    })

    it('POST /libraries/:libUUID create the log entry', function(done) {

      request(app)
        .post(`/libraries/${libUUID}`)
        .set('Authorization', 'JWT ' + token) 
        .set('Accept', 'application/json')
        .attach('file', 'fruitfiles/20141213.jpg')
        .field('sha256', sha256Of20141213)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let filepath = path.join(cwd, 'tmptest', 'log', libUUID)
          fs.readFile(filepath, (err, data) => {
            let parsed = JSON.parse(data.toString().trim())
            expect(res.body).to.deep.equal(parsed)
            done()
          })
        })
    })

    it('GET /libraries/:libUUID/log return logs', function(done) {


      let data =  '\n{"digest":"7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be","ctime":1473755241603}' +
                  '\n{"digest":"21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7","ctime":1473757645777}'

      let obj = [
        {
          digest: '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be',
          ctime: 1473755241603
        },
        {
          digest: '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7',
          ctime: 1473757645777
        }
      ]

      let fpath = path.join(cwd, 'tmptest', 'log', libUUID)
      fs.writeFile(fpath, data, err => {
        
        request(app)
          .get(`/libraries/${libUUID}/log`)
          .set('Authorization', 'JWT ' + token)
          .set('Accept', 'application/json')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body).to.deep.equal(obj)
            done()
          })
      })
    })
  })
})
