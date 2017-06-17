const sinon = require('sinon')
const UUID = require('uuid')
const request = require('supertest')

const app = require('src/fruitmix/app')

const IDS = {

  alice: {
    uuid:'9f93db43-02e6-4b26-8fae-7d6f51da12af',
    home: 'e2adb5d0-c3c7-4f2a-bd64-3320a1ed0dee',
    unionId: "ocMvos6NjeKLIBqg5Mr9QjxrP1FA"
  },

  bob: {
    uuid: 'a278930c-261b-4a9c-a296-f99ed00ac089',
    home: 'b7566c69-91f5-4299-b4f4-194df92b01a9',
  },

  charlie: {
    uuid: 'c12f1332-be48-488b-a3ae-d5f7636c42d6',
    home: '1da855c5-33a9-43b2-a93a-279c6c17ab58',
  },

  david: {
    uuid: '991da067-d75a-407d-a513-a5cf2191e72e',
    home: 'b33c3449-a5d4-4393-91c5-6453aeaf5f41',
  },

  emma: {
    uuid: 'fb82cf8f-cfbf-4721-a85e-990e3361a7dc',
    home: '37f4b93f-051a-4ece-8761-81ed617a28bd',
  },

  frank: {
    uuid: '50fac2de-84fe-488f-bd06-f1312aa03852',
    home: '0e040acf-198f-427d-a3a3-d28f9fc17564',
  },

  publicDrive1: {
    uuid: '01f7bcfd-8576-4dc5-b72f-65ad2acd82b2',
  }
}

const FILES = {

  hello: {
    path: 'img/hello',
    size: 6,
    hash: '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'
  },

  alonzo: {
    path: 'img/alonzo_church.jpg',
    size: 39499, 
    hash: '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408'
  } 
}

const stubUserUUID = username => 
  sinon.stub(UUID, 'v4')
    .onFirstCall().returns(IDS[username].uuid)
    .onSecondCall().returns(IDS[username].home)
    .onThirdCall().throws(new Error('function called more than twice'))

const createUserAsync = async(username, token, isAdmin) => {

  let props = { username, password: username }
  if (isAdmin) props.isAdmin = true

  let req = request(app)
    .post('/users')
    .send(props)
    .expect(200)

  if (token) req.set('Authorization', 'JWT ' + token)

  stubUserUUID(username)
  try {
    let res = await req 
    let real = res.body.uuid 
    let expected = IDS[username].uuid
    if (real !== expected) throw new Error(`user uuid mismatch, real ${real}, expected ${expected}`)
    return res.body
  }
  finally {
    UUID.v4.restore()
  }
}

/**
Retrieve test user's token
*/
const retrieveTokenAsync = async username => 
  (await request(app)
    .get('/token')
    .auth(IDS[username].uuid, username)).body.token

const createPublicDriveAsync = async (props, token, uuid) => {

  if (!token || !uuid) throw new Error('token and uuid must be provided')

  let req = request(app)
    .post('/drives')
    .send(props)
    .set('Authorization', 'JWT ' + token)
    .expect(200)

  sinon.stub(UUID, 'v4').returns(uuid) 
  try {
    let res = await req
    if (res.body.uuid !== uuid) 
      throw new Error(`drive uuid mismatch, real ${res.body.uuid}, expected ${uuid}`)
    return res.body
  }
  finally {
    UUID.v4.restore()
  }
}

const setUserUnionIdAsync = async username => {

  let token = await retrieveTokenAsync(username)

  return (await request(app)
    .patch(`/users/${IDS[username].uuid}`)
    .set('Authorization', 'JWT ' + token)
    .send({ unionId: IDS[username].unionId })
    .expect(200)).body
}

module.exports = {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserUnionIdAsync
}

