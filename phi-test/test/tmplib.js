const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const request = require('supertest')

// node src/utils/md4Encrypt.js alice
const USERS = {
  alice: {
    uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
    username: 'alice',
    password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
    smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
    lastChangeTime: 1523867673407,
    isFirstUser: true,
    phicommUserId: 'alice',
    status: 'ACTIVE'
  },
  bob: {
    uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
    username: 'bob',
    password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
    smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
    lastChangeTime: 1523867673407,
    isFirstUser: false,
    phicommUserId: 'bob',
    status: 'ACTIVE'
  },
  charlie: {
    uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
    username: 'charlie',
    password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
    smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
    lastChangeTime: 1523867673407,
    isFirstUser: false,
    phicommUserId: 'charlie',
    status: 'ACTIVE'
  }
}

const DRIVES = {
  alicePrivate: {
    uuid: '778d6f5b-624d-4885-ae86-145180893d83',
    type: 'private',
    owner: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
    tag: 'home',
    label: '',
    isDeleted: false
  },
  bobPrivate: {
    uuid: '877d6f5b-624d-4885-ae86-145180893d83',
    type: 'private',
    owner: '844921ed-bdfd-4bb2-891e-78e358b54869',
    tag: 'home',
    label: '',
    isDeleted: false
  },
  charliePrivate: {
    uuid: '866d6f5b-624d-4885-ae86-145180893d83',
    type: 'private',
    owner: '7805388f-a4fd-441f-81c0-4057c3c7004a',
    tag: 'home',
    label: '',
    isDeleted: false
  },
  buildIn: {
    uuid: 'd9d2acf2-e380-45a8-a47d-bada96b4d3f6',
    type: 'public',
    writelist: '*',
    readlist: '*',
    label: '',
    tag: 'built-in'
  },
  public1: {
    uuid: '9992acf2-e380-45a8-a47d-bada96b4d3f6',
    type: 'public',
    writelist: ['844921ed-bdfd-4bb2-891e-78e358b54869'],
    readlist: [],
    label: 'public1'
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

/**
 * 
 * @param {string} fruitmixDir - path string
 * @param {object} opts 
 * @param {array} opt.users
 * @param {array} opt.drives
 * @param {object} opt.tags
 * @param {array} opt.tags.tags
 * @param {number} opt.tags.index 
 */
const initFruitFilesAsync = async (fruitmixDir, opts) => {
  await rimrafAsync(fruitmixDir)
  await mkdirpAsync(fruitmixDir)
  if (opts.users) await fs.writeFileAsync(path.join(fruitmixDir, 'users.json'), JSON.stringify(opts.users, null, '  '))
  if (opts.drives) await fs.writeFileAsync(path.join(fruitmixDir, 'drives.json'), JSON.stringify(opts.drives, null, '  '))
  if (opts.tags) await fs.writeFileAsync(path.join(fruitmixDir, 'tags.json'), JSON.stringify(opts.tags, null, '  '))
}

module.exports = {
  USERS,
  DRIVES,
  requestToken,
  requestTokenAsync,
  initFruitFilesAsync,
  initUsersAsync
}
