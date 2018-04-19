const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const request = require('supertest')

const USERS = {
  alice : {
    uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
    username: 'alice',
    password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
    smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
    lastChangeTime: 1523867673407,
    isFirstUser: true,
    phicommUserId: 'alice'
  },
  bob : {
    uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
    username: 'bob',
    isFirstUser: false,
    password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
    smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
    lastChangeTime: 1523867673407,
    isFirstUser: false,
    phicommUserId: 'bob'
  },
  charlie : {
    uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
    username: 'charlie',
    password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
    smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
    lastChangeTime: 1523867673407,
    isFirstUser: false,
    phicommUserId: 'charlie'
  }
}


const requestToken = (app, userUUID, password, callback) => {
  request(app)
    .get('/token')
    .auth(userUUID, password)
    .expect(200)
    .end((err, res) => {
      if (err) return callback(err)
      callback(null, res.body.token)
    })
}

const requestTokenAsync = Promise.promisify(requestToken)

const initUsersAsync = async (fruitmixDir, users) => {
  if (!users) users = []
  await rimrafAsync(fruitmixDir)
  await mkdirpAsync(fruitmixDir)
  let usersFile = path.join(fruitmixDir, 'users.json')
  await fs.writeFileAsync(usersFile, JSON.stringify(users, null, '  '))
}

module.exports.USERS = USERS
module.exports.requestToken = requestToken
module.exports.requestTokenAsync = requestTokenAsync
module.exports.initUsersAsync = initUsersAsync