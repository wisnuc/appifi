const Promise = require('bluebird') 
const request = require('supertest')

const requestToken = (express, userUUID, password, callback) =>
  request(express)
    .get('/token')
    .auth(userUUID, password)
    .expect(200)
    .end((err, res) => err ? callback(err) : callback(null, res.body.token))

const requestTokenAsync = Promise.promisify(requestToken)

const requestHome = (express, { user, token }, callback) =>
  request(express)
    .get('/drives')
    .set('Authorization', 'JWT ' + token)
    .expect(200)
    .end((err, res) => {
      if (err) return callback(err)
      let home = res.body.find(d => d.type === 'private' && d.owner === user.uuid)
      if (!home) {
        callback(new Error('home drive not found'))
      } else {
        callback(null, home)
      }
    })

const requestHomeAsync = Promise.promisify(requestHome)

const list = (express, { token, driveUUID, dirUUID }, callback) => 
  request(express)
    .get(`/drives/${driveUUID}/dirs/${dirUUID}`)
    .set('Authorization', 'JWT ' + token)
    .expect(200)
    .end((err, res) => err ? callback(err) : callback(null, res.body))

const listAsync = Promise.promisify(list)

const mkdir = (express, { token, driveUUID, dirUUID, name, policy }, callback) =>
  request(express)
    .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
    .set('Authorization', 'JWT ' + token)
    .field(name, JSON.stringify({ op: 'mkdir', policy }))
    .expect(200)
    .end((err, res) => err ? callback(err) : callback(null, res.body[0].data))

const mkdirAsync = Promise.promisify(mkdir)

const newfile = (express, { 
  token, driveUUID, dirUUID, filename, filepath, size, sha256, policy 
}, callback) => request(express)
  .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
  .set('Authorizatoin', 'JWT ' + token)
  .attach(filename, filepath, JSON.stringify({
    op: 'newfile',
    size,
    sha256,
    policy
  }))
  .expect(200)
  .end((err, res) => err ? callback(err) : callback(null, res.body[0].data))

const newfileAsync = Promise.promisify(newfile)

module.exports = {
  requestToken,
  requestTokenAsync,
  requestHome,
  requestHomeAsync,
  list,
  listAsync,
  mkdir,
  mkdirAsync,
  newfile,
  newfileAsync
}

