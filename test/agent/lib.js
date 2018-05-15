const sinon = require('sinon')
const UUID = require('uuid')
const request = require('supertest')
const Promise = require('bluebird')
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const crypto = require('crypto')
const fs = Promise.promisifyAll(require('fs'))
const path = require('path')
const rimrafAsync = Promise.promisify(require('rimraf'))

const app = require('../../src/app')
const E = require('../../src/lib/error')
const fingerprintSimpleAsync = Promise.promisify(require('../../src/utils/fingerprintSimple'))

const IDS = {

  alice: {
    uuid:'9f93db43-02e6-4b26-8fae-7d6f51da12af',
    home: 'e2adb5d0-c3c7-4f2a-bd64-3320a1ed0dee',
    global: {id: "9f93db43-02e6-4b26-8fae-7d6f51da12fa",
             wx: ["ocMvos6NjeKLIBqg5Mr9QjxrP1FA"]}
  },

  bob: {
    uuid: 'a278930c-261b-4a9c-a296-f99ed00ac089',
    home: 'b7566c69-91f5-4299-b4f4-194df92b01a9',
    global: {id: "a278930c-261b-4a9c-a296-f99ed00ac980",
             wx: ["ocMvos6NjeKLIBqg5Mr9QjxrP1FB"]}
  },

  charlie: {
    uuid: 'c12f1332-be48-488b-a3ae-d5f7636c42d6',
    home: '1da855c5-33a9-43b2-a93a-279c6c17ab58',
    global: {id: "c12f1332-be48-488b-a3ae-d5f7636c462d",
             wx: ["ocMvos6NjeKLIBqg5Mr9QjxrP1FC"]}
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
  },

  publicDrive2: {
    uuid: '01f7bcfd-8576-4dc5-b72f-65ad2acd82b3',
  }
}

const FILES = {

  alonzo: {
    name: 'alonzo.jpg',
    path: 'testdata/alonzo.jpg',
    size: 39499, 
    hash: '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408'
  },

  bar: {
    name: 'bar',
    path: 'testdata/bar',
    size: 4,
    hash: '7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730' 
  },

  empty: {
    name: 'empty',
    path: 'testdata/empty',
    size: 0,
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  },

  foo: {
    name: 'foo',
    path: 'testdata/foo',
    size: 4,
    hash: 'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c'
  },

  hello: {
    name: 'hello',
    path: 'testdata/hello',
    size: 6,
    hash: '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'
  },

  vpai001: {
    name: 'vpai001',
    path: 'testdata/vpai001.jpg',
    size: 4192863,
    hash: '529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb', 
  },

  world: {
    name: 'world',
    path: 'testdata/world', 
    size: 6,
    hash: 'e258d248fda94c63753607f7c4494ee0fcbe92f1a76bfdac795c9d84101eb317'  
  },

  oneByteX: {
    name: 'one-byte-x',
    path: 'test-files/one-byte-x',
    size: 1,
    hash: '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881',
  },

  halfGiga: {
    name: 'half-giga',
    path: 'test-files/half-giga',
    size: 512 * 1024 * 1024,
    hash: '767c649bbc1535e53afe18d1d9e21828d36262eac19d60cc3035636e9bc3cdbb'
  },

  oneGiga: {
    name: 'one-giga',
    path: 'test-files/one-giga',
    size: 1024 * 1024 * 1024,
    hash: 'a728498b7d120ea93ff32f548df489e7e9feeefd5dab7124c12ee3e49ff84a91' 
  },

  oneGigaMinus1: {
    name: 'one-giga-minus-1',
    path: 'test-files/one-giga-minus-1',
    size: 1024 * 1024 * 1024 - 1,
    hash: 'dfbe42ebd0867f5dc8dc602f035237e88984c93a4e0a7ad7f92f462e326fa6f2'  
  },

  oneGigaPlusX: {
    name: 'one-giga-plus-x',
    path: 'test-files/one-giga-plus-x',
    size: 1024 * 1024 * 1024 + 1,
    hash: '9813e8dea92f5d5d2c422aa5191c29694531f012c13229fa65c90bb5538b0c6b'
  },

  oneAndAHalfGiga: {
    name: 'one-and-a-half-giga',
    path: 'test-files/one-and-a-half-giga',
    size: 1024 * 1024 * (1024 + 512),
    hash: 'd723ceb8be2c0f65b3ba359218553187f409f0bbb2ffd6a8f03464aa7dba46f5'
  },

  twoGiga: {
    name: 'two-giga',
    path: 'test-files/two-giga',
    size: 1024 * 1024 * 1024 * 2,
    hash: 'cf2981f9b932019aaa35122cbecd5cdd66421673d3a640ea2c34601d6c9d3a12'
  },

  twoGigaMinus1: {
    name: 'two-giga-minus-1',
    path: 'test-files/two-giga-minus-1',
    size: 1024 * 1024 * 1024 * 2 - 1,
    hash: '881e4980ed2d54067f5c534513b43f408040a615731c9eb76c06ff4945a3e3ae'
  },
  
  twoGigaPlusX: {
    name: 'two-giga-plus-x',
    path: 'test-files/two-giga-plus-x',
    size: 1024 * 1024 * 1024 * 2 + 1,
    hash: '38a664204a7253ef6f6b66bd8162170115d1661cde6a265c4d81c583ac675203'
  },

  twoAndAHalfGiga: {
    name: 'two-and-a-half-giga',
    path: 'test-files/two-and-a-half-giga',
    size: 1024 * 1024 * 1024 * 2 + 512 * 1024 * 1024,
    hash: 'c4eeea260304c747c4329a10274e7c4256a1bacff6545cada5f03e956f9d2c62' 
  },

  threeGiga: {
    name: 'three-giga',
    path: 'test-files/three-giga',
    size: 1024 * 1024 * 1024 * 3,
    hash: '31d98188bf9ad4f30e87dce7da1e44bead3ee2b6aca5b4f1b1be483fdc000f58'  
  },

  threeGigaMinus1: {
    name: 'three-giga-minus-1',
    path: 'test-files/three-giga-minus-1',
    size: 1024 * 1024 * 1024 * 3 - 1,
    hash: 'f34af33573a9710b3376013f3d337ef54813d21ef366f845c4ae105df50b6862' 
  },

  threeGigaPlusX: {
    name: 'three-giga-plus-x',
    path: 'test-files/three-giga-plus-x',
    size: 1024 * 1024 * 1024 * 3 + 1,
    hash: '4f78a807e5b0909a06ce68d58f5dccc581db6bbc51a00bb07148ec599a9d2a32'  
  },

  threeAndAHalfGiga: {
    name: 'three-and-a-half-giga',
    path: 'test-files/three-and-a-half-giga',
    size: 1024 * 1024 * 1024 * 3 + 512 * 1024 * 1024,
    hash: 'a55587006fb9125fd09e7d8534ab6e7e0e9ec47aa02fc6d8495a3bb43d3968bb' 
  },

  fourGiga: {
    name: 'four-giga',
    path: 'test-files/four-giga',
    size: 1024 * 1024 * 1024 * 4,
    hash: '66099adb50d529ee26f9a9ec287ec1c9677189d1928d7ca8681ea4c66d85d43f'
  },

  fiveGiga: {
    name: 'five-giga',
    path: 'test-files/five-giga',
    size: 5 * 1024 * 1024 * 1024,
    hash: '757deb7202aa7b81656922322320241fc9cc6d8b5bb7ff60bdb823c72e7ca2fd'
  },

}

const stubUserUUID = username => 
  sinon.stub(UUID, 'v4')
    .onFirstCall().returns(IDS[username].uuid)
    .onSecondCall().returns(IDS[username].home)
    .onThirdCall().throws(new Error('function called more than twice'))

const createUserAsync = async (username, token, isAdmin) => {

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

const setUserGlobalAsync = async username => {

  let token = await retrieveTokenAsync(username)

  return (await request(app)
    .patch(`/users/${IDS[username].uuid}`)
    .set('Authorization', 'JWT ' + token)
    .send({ global: IDS[username].global })
    .expect(200)).body
}


// only useful for local user
const laCloudTokenAsync = async username => {

  let token = await retrieveTokenAsync(username)

  let res = await request(app)
    .get('/cloudToken')
    .query({ guid: IDS[username].global.id})
    .set('Authorization', 'JWT ' + token)
    .expect(200)

  return res.body.token
}

const waCloudTokenAsync = async (username) => {
  let res = await request(app)
    .get('/cloudToken')
    .query({ guid: IDS[username].global.id})
    .expect(200)
  return res.body.token
}

const createBoxAsync = async (props, username) => {

  let token = await retrieveTokenAsync(username)
  let cloudToken = await laCloudTokenAsync(username)

  let res = await request(app)
    .post('/boxes')
    .send(props)
    .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
    .expect(200)

  return res.body
}

const createBranchAsync = async (props, boxUUID, username) => {
  let token = await retrieveTokenAsync(username)
  let cloudToken = await waCloudTokenAsync(username)

  let res = await request(app)
    .post(`/boxes/${boxUUID}/branches`)
    .send(props)
    .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
    .expect(200)

  return res.body
}

const forgeRecords = async (boxUUID, username) => {
  let token = await retrieveTokenAsync(username)
  let cloudToken = await laCloudTokenAsync(username)

  // UUID.v4 is modified by sinon
  // it is only installed three returns
  // UUID.v4 has been called once when create a box(boxUUID)
  // so there are only two returns can be used
  // in this loop, UUID.v4 is required
  // but only the first two can get a result, this won't influence the data we need
  for(let i = 0; i < 10; i++) {
    let res = await request(app)
      .post(`/boxes/${boxUUID}/tweets`)
      .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
      .send({comment: 'hello'})
      .expect(200)
  }
}

// calculate tree object of a directory, return root and hashArr map
// hashArr contain tree object hash and blob hash
const createTreeObjectAsync = async dir => {
  // console.log(process.cwd())
  let tmpDir = path.join(process.cwd(), UUID.v4())
  let hashArr = new Map()
  // {fingerprint:xxxx, path:[]}
  await mkdirpAsync(tmpDir)

  // loop
  let storeDirAsync = async dir => {
    let stat = await fs.lstatAsync(dir)
    if (!stat.isDirectory()) throw new E.ENOTDIR()

    let entries = await fs.readdirAsync(dir)

    if (entries.length === 0) return
    let treeEntries = await Promise
      .map(entries, async entry => {
        let entryPath = path.join(dir, entry)
        let stat = await fs.lstatAsync(entryPath)

        if (stat.isDirectory()) {
          let fingerprint = await storeDirAsync(entryPath)
          let fpath = path.join(tmpDir, fingerprint)
          if (hashArr.has(fingerprint)) {
            let result = hashArr.get(fingerprint)
            result.path.add(fpath)
          } else {
            let size = fs.lstatSync(fpath).size
            let obj = {fingerprint, path: new Set([fpath]), size}
            hashArr.set(fingerprint, obj)
          }

          return ['tree', entry, fingerprint]
        }
         
        if (stat.isFile()) {
          let fingerprint = await fingerprintSimpleAsync(entryPath)

          if (hashArr.has(fingerprint)) {
            let result = hashArr.get(fingerprint)
            result.path.add(entryPath)
          } else {
            let obj = {fingerprint, path: new Set([entryPath]), size: stat.size}
            hashArr.set(fingerprint, obj)
          }

          return ['blob', entry, fingerprint]
        }

        return null
      })
      .filter(treeEntry => !!treeEntry)

    treeEntries = treeEntries.sort((a, b) => a[1].localeCompare(b[1]))
    // validateTree(treeEntries)
    let fingerprint = await storeObjectAsync(treeEntries, tmpDir)

    return fingerprint
  }

  let root = await storeDirAsync(dir)
  let rootpath = path.join(tmpDir, root)

  if (hashArr.has(root)) {
    let result = hashArr.get(root)
    result.path.add(rootpath)
  } else {
    let size = fs.lstatSync(rootpath).size
    let obj = {fingerprint: root, path: new Set([rootpath]), size}
    hashArr.set(root, obj)
  }
  // root is the sha256 of rootTree
  // hashArr contains all the file hash and sub tree hash in rootTree(including rootTree hash)
  return {tmpDir, root, hashArr} 
}

const storeObjectAsync = async (tree, dir) => {
  let text, hash, digest, tmppath

  text = JSON.stringify(tree, null, '  ')
  hash = crypto.createHash('sha256')
  hash.update(text)
  digest = hash.digest().toString('hex')

  let dst = path.join(dir, digest)
  try {
    let stats = await fs.lstatAsync(dst)
    return digest  
  }
  catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
    
  await writeFileToDiskAsync(dst, text)
  return digest //{fingerprint: digest, path: dst}
}

const writeFileToDisk = (fpath, data, callback) => {

  let error, os = fs.createWriteStream(fpath)

  os.on('error', err => {
    error = err
    callback(err)
  })

  os.on('close', () => {
    if (!error) callback(null)
  })

  os.write(data)
  os.end()
}

const writeFileToDiskAsync = Promise.promisify(writeFileToDisk)

const getCommitAsync = async (boxUUID, username, commitHash) => {
  let token = await retrieveTokenAsync(username)
  let cloudToken = await laCloudTokenAsync(username)

  return (await request(app)
    .get(`/boxes/${boxUUID}/commits/${commitHash}`)
    .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
    .expect(200)).body
}

const getTreeListAsync = async (boxUUID, username, treeHash) => {
  let token = await retrieveTokenAsync(username)
  let cloudToken = await laCloudTokenAsync(username)

  return (await request(app)
    .get(`/boxes/${boxUUID}/trees/${treeHash}`)
    .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
    .expect(200)).body
}

// create a new commit
// props is optional {parent, branch}
const createCommitAsync = async (dir, boxUUID, username, props) => {
  let token = await retrieveTokenAsync(username)
  let cloudToken = await laCloudTokenAsync(username)

  // calculate hash array in dir(hash array of trees and blobs)
  let testDir = 'testdata'
  let result = await createTreeObjectAsync(testDir)

  // get parent hash array
  let parentCommit, parentTreeList = []
  if (props && props.parent) {
    parentCommit = await getCommitAsync(boxUUID, username, props.parent)
    parentTreeList = await getTreeListAsync(boxUUID, username, parentCommit.tree)
  }

  // calculate files to upload
  let toUpload = [...result.hashArr.keys()].reduce((pre, c) => parentTreeList.includes(c) ? pre : [...pre, c], [])

  // root: hash string of a tree obj
  let obj = toUpload.length !== 0 ? Object.assign({ root: result.root, toUpload }, props)
                                  : Object.assign({ root: result.root}, props)

  let res = request(app)
    .post(`/boxes/${boxUUID}/commits`)
    .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
    .field('commit', JSON.stringify(obj))

  for (let i = 0; i < toUpload.length; i++) {
    let info = result.hashArr.get(toUpload[i])
    let fpath = [...info.path][0]

    res.attach(toUpload[i], fpath, JSON.stringify({size: info.size, sha256: toUpload[i]}))
  }

  let commit = (await res.expect(200)).body
  commit.hashArr = [...result.hashArr.keys()]
  // commit: {sha256, commitObj, hashArr}
  // sha256 is the hash of commitObj
  // hashArr is the content hash in commitObj.tree, including tree hash and blob hash
  await rimrafAsync(result.tmpDir)

  return commit
}

const createTagAsync = async (props, username) => {
  let token = await retrieveTokenAsync(username)
  let rs = await request(app)
    .post('/tags')
    .set('Authorization', 'JWT ' + token)
    .send(props)
    .expect(200)
  return rs.body
}


module.exports = {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserGlobalAsync,
  laCloudTokenAsync,
  waCloudTokenAsync,
  createBoxAsync,
  createBranchAsync,
  forgeRecords,
  createTreeObjectAsync,
  getCommitAsync,
  getTreeListAsync,
  createCommitAsync,
  createTagAsync
}

