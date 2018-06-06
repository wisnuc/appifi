const crypto = require('crypto')
const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const request = require('supertest')
const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const { requestTokenAsync, initUsersAsync, initFruitFilesAsync, USERS, DRIVES } = require('./tmplib')

// 文件列表
const fileArr = [
  { path: path.join(__dirname, './lib.js'), addTags: [], addExpectCode: 400, removeTags: [], removeExpectCode: 400,
    addExpected: `expect(res.body.message).to.deep.equal("invalid tags")`,
    removeExpected: `expect(res.body.message).to.deep.equal("invalid tags")`
  },
  { path: path.join(__dirname, './users.js'), addTags: [0], removeTags: [0], remainTags:[],
    removeExpected: `expect(res.body[0].data.tags).to.deep.equal(undefined)`
  },
  { path: path.join(__dirname, './drives.js'), addTags: [0, 1], removeTags: [1], remainTags:[0]},
  { path: path.join(__dirname, './token.js'), addTags: [0, 1, 2], removeTags: [1,2], remainTags:[0]}
]

// 获取dirve
const getHome = (app, token) => {
  return new Promise((resolve, reject) => {
    request(app)
    .get('/drives')
    .set('Authorization', 'JWT ' + token)
    .end((err, res) => {
      let result = res.body.find(item => item.tag == 'home')
      if (result) resolve(result.uuid)
      else reject('...')
    })
  })
}

// 上传文件
const uploadFile = (app, token, driveId, dirId, filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    hash.setEncoding('hex')
    fileStream = fs.createReadStream(filePath)
    fileStream.on('end', () => {
      hash.end()
      let sha256 = hash.read()
      let obj = fs.lstat(filePath, (err, data) => {
        let { size } = data
        request(app)
          .post(`/drives/${driveId}/dirs/${dirId}/entries`)
          .set('Authorization', 'JWT ' + token)
          .attach(path.basename(filePath), filePath, JSON.stringify({
            op: 'newfile', 
            size, sha256
          }))
          .end((err, res) => {
            if (err) return console.log(err)
            resolve(res.body[0].data)
          })
      })
    })
    fileStream.on('error', reject)
    fileStream.pipe(hash)
  })
}


const tasks = [
  { it: 'alice创建Tag 0', type: 'post', url:'/tags', args: {name:'tag0', color: '#333'}, expectCode: 200, 
    expected: "expect(res.body.id).to.deep.equal(0);expect(res.body.name).to.deep.equal('tag0')" },
  { it: 'alice创建Tag 1', type: 'post', url:'/tags', args: {name:'tag1', color: '#333'}, expectCode: 200, 
    expected: "expect(res.body.id).to.deep.equal(1);expect(res.body.name).to.deep.equal('tag1')" },
  { it: 'alice创建Tag 2', type: 'post', url:'/tags', args: {name:'tag2', color: '#333'}, expectCode: 200, 
    expected: "expect(res.body.id).to.deep.equal(2);expect(res.body.name).to.deep.equal('tag2')" },
  { it: 'alice创建Tag 3', type: 'post', url:'/tags', args: {name:'tag3', color: '#333'}, expectCode: 200, 
    expected: "expect(res.body.id).to.deep.equal(3);expect(res.body.name).to.deep.equal('tag3')" },
]

fileArr.forEach(item => {
  let addTags = item.addTags
  let fileName = path.basename(item.path)
  let addExpected = item.addExpected? item.addExpected: `expect(res.body[0].data.tags).to.deep.equal([${addTags}])`
  let addExpectCode = item.addExpectCode? item.addExpectCode: 200
  let addQueryExpected = addTags.length?
    `expect(res.body.entries.find(item => item.name === "${fileName}").tags).to.deep.equal([${addTags}])`:
    `expect(res.body.entries.find(item => item.name === "${fileName}").tags).to.deep.equal(undefined)`
  let removeTags = item.removeTags

  let removeExpectCode = item.removeExpectCode? item.removeExpectCode: 200
  let removeExpected = item.removeExpected? item.removeExpected: `expect(res.body[0].data.tags).to.deep.equal([${item.remainTags}])`

  // 给文件添加tags
  tasks.push({
    it: `${fileName} 添加tag [${addTags}]`, type: 'post', 
    url: `/drives/${DRIVES.alicePrivate.uuid}/dirs/${DRIVES.alicePrivate.uuid}/entries`,
    field: {key: fileName, value: JSON.stringify({op: 'addTags', tags:addTags})},
    expectCode: addExpectCode, 
    expected: addExpected
  })

  // 查询tags
  tasks.push({
    it: `查询文件 ${fileName} 包含 tag [${addTags}]`, type: 'get', 
    url: `/drives/${DRIVES.alicePrivate.uuid}/dirs/${DRIVES.alicePrivate.uuid}`,
    expectCode: 200,
    expected: addQueryExpected
  })

  // // 删除tags
  tasks.push({
    it: `${fileName} 删除tag [${removeTags}]`, type: 'post',
    url: `/drives/${DRIVES.alicePrivate.uuid}/dirs/${DRIVES.alicePrivate.uuid}/entries`,
    field: {key: fileName, value: JSON.stringify({op: 'removeTags', tags: removeTags})},
    expectCode: 200, 
    expected: removeExpected
  })

    // 查询tags
    tasks.push({
      it: `查询文件 ${fileName} 包含 tag `, type: 'get', 
      url: `/drives/${DRIVES.alicePrivate.uuid}/dirs/${DRIVES.alicePrivate.uuid}`,
      expectCode: 200,
      expected: ``
    })

})

describe(path.basename(__filename), () => {
  let fruitmix, app, tokenAlice, tokenBob, aliceHome

  // 初始化APP
  const initApp = done => {
    fruitmix = new Fruitmix({ fruitmixDir })
    app = new App({ fruitmix })
    fruitmix.on('FruitmixStarted', async () => {
      tokenAlice = await requestTokenAsync(app.express, USERS.alice.uuid, 'alice')
      aliceHome = await getHome(app.express, tokenAlice)
      let promises = fileArr.map(async item => 
        uploadFile(app.express, tokenAlice, aliceHome, aliceHome, item.path))
      
      Promise.all(promises).then(data => {
        done()
      })
    })
  }

  before(done => {
    // 创建fruitmix 相关文件
    initFruitFilesAsync(fruitmixDir, {users: [USERS.alice], drives: [DRIVES.alicePrivate]}).then(() => {
      initApp(done)
    })
  })


  tasks.forEach(item => {
    if (item.field) {
      it(item.it, done => {
        let token = item.token? tokenBob: tokenAlice
        request(app.express)[item.type](item.url)
          .set('Authorization', 'JWT ' + token)
          .send(item.args)
          .field(item.field.key, item.field.value)
          .expect(item.expectCode)
          .end((err, res) => {
            // console.log(Array.isArray(res.body[0].data.tags))
            // if (res.statusCode !== 200) console.log(res.body, err)
            console.log(res.body, err)
            eval(item.expected)
            done()
          })
      })
    }else {
      it(item.it, done => {
        let token = item.token? tokenBob: tokenAlice
        request(app.express)[item.type](item.url)
          .set('Authorization', 'JWT ' + token)
          .send(item.args)
          .expect(item.expectCode)
          .end((err, res) => {
            // if (res.statusCode !== 200) console.log(res.body, err)
            // console.log(res.body, err)
            eval(item.expected)
            done()
          })
      })
    }
  })
  
})