const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const Mocha = require('mocha')

// rimraf.sync('meta-test/generated')
// mkdirp.sync('meta-test/generated')

let fd = fs.openSync('meta-test/generated/user.js', 'w+')

fs.writeSync(fd, `
const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')
const { USERS, requestToken, initUsersAsync } = require('./tmplib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = tmptest

const { alice, bob, charlie } = USERS
`)


const typeEnum = [ undefined, null, ' ', {}, false, [], 123123123123 ]

const opts = {
  phicommUserId: typeEnum,
  username: typeEnum
}


const groups = [
  {
    desc: 'non-admin create user',
    tests: [
      {
        opts: {
          phicommUserId: [alice.phicommUserId + 1],
          username: [alice.username + '1']
        },
        it: `non-admin should return error`,
      }
    ]
  },
  {
    desc: 'admin create user',
    tests: [
      {
        opts: {
          phicommUserId: [undefined, null, {}, [], 'hello', 'number out of range'],
          username: [undefined, null, {}, [], 'invalid']
        },
        it: `phicommUserId: ${phicommUserId} & username: ${username} invalid params should return error`,
      },
      {
        opts: {
          phicommUserId: [alice.phicommUserId],
          username: [alice.username]
        },
        it: `phicommUserId: ${phicommUserId} || username: ${username} params conflict should return error`,
      },
      {
        opts: {
          phicommUserId: [alice.phicommUserId + 1],
          username: [alice.username + '1']
        },
        it: `phicommUserId: ${phicommUserId} || username: ${username} should return error`,
      }
    ]
  }
]

groups.forEach(group => {
  const { desc, tests } = group
  // generate it
  tests.forEach(test => {
    const { }
    fs.write(fd, `
    requestToken(app.express, alice.uuid, 'alice', (err, token) => {
      if (err) return done(err)
      request(app.express)
        .post('/users')
        .set('Authorization', 'JWT ' + token)
        .send({
          username: 'Jack',
          phicommUserId: 'Jack'
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.username).to.equal('Jack')
          expect(res.body.phicommUserId).to.equal('Jack')
          expect(fruitmix.users.length).to.equal(3)
          expect(fruitmix.users[2].username).to.equal('Jack')
          console.log(res.body)
          done()
        })
    `)


//   describe(desc, () => {
//     beforeFunc()

//     afterFunc()
// })
// const generateDesc = (beforeFunc, afterFunc) => {
//   describe(path.basename(__filename), () => {

//     })
//   })
}


const generateIt = () => {
  it('bob update alice`s username should fail', done => {
    let data = createUserSpecFunc(users, props)
    request(app.express)
      .post(`/users`)
      .set('Authorization', 'JWT ' + token)
      .send({
        username: props.username,
        phicommUserId: props.phicommUserId
      })
      .expect(data.status)
      .end((err, res) => {
        if (err) return done(err===res.response.status)
        expect(res).to.deep.equal(res.system)
        done()
      })
  })
}

