import path from 'path'

import filter from 'filter-object'
import { expect } from 'chai'
import sinon from 'sinon'
import UUID from 'node-uuid'
import { rimrafAsync, mkdirpAsync, fs } from 'src/fruitmix/util/async'
import { createUserModel } from 'src/fruitmix/models/userModel'

import models from 'src/fruitmix/models/models'

const uuid1 = '1ee2be49-05c4-4ae1-b249-cd6f4cf04376' 
const userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
const drv001UUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
const drv002UUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 
const cwd = process.cwd()

const userFilePath = path.join(cwd, 'tmptest', 'users.json')
const tmpdir = path.join(cwd, 'tmptest', 'tmp')

const users = [
  {
    type: 'local',
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


describe(path.basename(__filename), function() {

  const cwd = process.cwd()
  
  let myUserModel  
  let createData = {
    username:"u1", 
    "password":"1122334", 
    "avatar":"", 
    "email":"aaa@bbb.com", 
    "isAdmin":false, 
    "type":""
  }

  describe('test createUserModel', function(done) {

    beforeEach(() => (async () => {
      await rimrafAsync('tmptest')          
      await mkdirpAsync('tmptest/tmp')
    })())

    it('should create a user model with empty colletion and given paths', function(done) {

      let fpath = path.join(cwd, 'tmptest', 'users.json')
      let tmpdir = path.join(cwd, 'tmptest', 'tmp')

      createUserModel(fpath, tmpdir, (err, umod) => {
        let col = umod.collection  
        expect(col.filepath).to.equal(fpath)
        expect(col.tmpfolder).to.equal(tmpdir)
        expect(col.list).to.deep.equal([])
        done()
      })
    })
  })

  describe('test creating first user', function(done) {  

    const fakeUUID = '99f5644b-9588-47bc-a0e2-b57be75e25cd' 
    let umod 

    let inputMinimal = {
      type: 'local',
      username: 'hello',
      password: 'world',
    }

    let inputSmb = {
      type: 'local',
      username: 'foo',
      password: 'bar',
    }

    beforeEach(() => (async () => {
      const fpath = path.join(cwd, 'tmptest', 'users.json')
      const tmpdir = path.join(cwd, 'tmptest', 'tmp')
      await rimrafAsync('tmptest')
      await mkdirpAsync('tmptest/tmp')
      umod = await Promise.promisify(createUserModel)(fpath, tmpdir) 
    })())

    it('should keep type, username, (input minimal)', function(done) {
      umod.createUser(inputMinimal, (err, user) => {
        if (err) return done(err)
        const f = ['type', 'username']
        expect(filter(user, f)).to.deep.equal(filter(inputMinimal, f))
        done()
      })
    })

    it('should have lastChangetime', function(done) {
      umod.createUser(inputMinimal, (err, user) => {
        expect(user.lastChangeTime).to.be.a('number')
        done()
      })
    })

    it('should have avatar, email, as null (input minimal)', function(done) {
      umod.createUser(inputMinimal, (err, user) => {
        expect(user.avatar).to.be.null
        expect(user.email).to.be.null
        done()
      })
    })

    it('should have uuid as faked (input minimal)', function(done) {

      sinon.stub(UUID, 'v4').returns(fakeUUID)
      umod.createUser(inputMinimal, (err, user) => {
        if (err) {
          UUID.v4.restore()
          return done(err)
        }
        expect(user.uuid).to.equal(fakeUUID)
        UUID.v4.restore()
        done()
      })
    })

    it('should be firstUser and admin (input minimal)', function(done) {
      umod.createUser(inputMinimal, (err, user) => {
        if (err) return done(err)
        expect(user.isFirstUser).to.be.true
        expect(user.isAdmin).to.be.true
        done()
      })
    })

    it('should return an error if username is not a string', function(done) {
      let input = Object.assign({}, inputMinimal, { username: 123 }) 
      umod.createUser(input, (err, user) => {
        expect(err).to.be.an('error')
        done()
      })
    })

    it('should return an error if password is not a string', function(done) {
      let input = Object.assign({}, inputMinimal, { password: 123 }) 
      umod.createUser(input, (err, user) => {
        expect(err).to.be.an('error')
        done()
      })
    })
    
    it('should return an error if password is empty', function(done) {
      let input = Object.assign({}, inputMinimal, { password: '' }) 
      umod.createUser(input, (err, user) => {
        expect(err).to.be.an('error')
        done()
      })
    })
  })

  describe('verifyPassword', function() {

    const userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
    const drv001UUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
    const drv002UUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 

    const cwd = process.cwd()
    const userFilePath = path.join(cwd, 'tmptest', 'users.json')
    const tmpdir = path.join(cwd, 'tmptest', 'tmp')

    const users = [
      {
        type: 'local',
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

    beforeEach(() => (async () => {
      await rimrafAsync('tmptest')          
      await mkdirpAsync('tmptest/tmp')
      await fs.writeFileAsync(userFilePath, JSON.stringify(users)) 
      let userModel = await Promise.promisify(createUserModel)(userFilePath, tmpdir)
      models.setModel('user', userModel) 
    })())

    it('should return user if password match', function(done) {
      let umod = models.getModel('user')
      umod.verifyPassword(userUUID, 'world', (err, user) => {
        if (err) return done(err)
        expect(user).to.equal(umod.collection.list[0])
        done()
      })
    })

    it('should return null if user does NOT exist', function(done) {
      let umod = models.getModel('user')
      umod.verifyPassword(uuid1, 'world', (err, user) => {
        if (err) return done(err)
        expect(user).to.be.null 
        done()
      })
    })

    it('should return null if password mismatch', function(done) {
      let umod = models.getModel('user')
      umod.verifyPassword(userUUID, 'foobar', (err, user) => {
        if (err) return done(err)
        expect(user).to.be.nul
        done()
      })
    })
  })
})

