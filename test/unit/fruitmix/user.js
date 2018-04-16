const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const User = require('src/fruitmix/User')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {

  const opts = {
    file: path.join(tmptest, 'fruitmix', 'users.json'),
    tmpDir: path.join(tmptest, 'fruitmix', 'tmp')
  }

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(path.join(tmptest, 'chassis'))
    await mkdirpAsync(path.join(tmptest, 'fruitmix'))
  })

  it('should do something', done => {
    let UserList = new User(opts) 
    UserList.createUser({ hello: 'world' }, err => {
      if (err) return done(err)
      console.log(UserList.store)
      done()
    }) 
  })
})
