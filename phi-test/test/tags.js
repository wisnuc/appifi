const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const request = require('supertest')
const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const USERS = require('./tmplib').USERS
const requestTokenAsync = require('./tmplib').requestTokenAsync
const initUsersAsync = require('./tmplib').initUsersAsync

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

describe(path.basename(__filename), () => {
  let fruitmix, app, tokenAlice, tokenBob, aliceHome

  // 初始化APP
  const initApp = done => {
    fruitmix = new Fruitmix({ fruitmixDir })
    app = new App({ fruitmix })
    fruitmix.on('FruitmixStarted', async () => {
      tokenAlice = await requestTokenAsync(app.express, USERS.alice.uuid, 'alice')
      tokenBob = await requestTokenAsync(app.express, USERS.bob.uuid, 'bob')
      aliceHome = await getHome(app.express, tokenAlice)
      done()
    })
  }

  describe('创建 tag', () => {
    let recordId 
    before(done => {
      // 创建fruitmix 相关文件
      initUsersAsync(fruitmixDir, [USERS.alice, USERS.bob]).then(() => {
        initApp(done)
      })
    })

    let arr = [
      // 非法name参数测试
      { it: 'name为空字符串', type: 'post', url:'/tags', args: {name:'', color: '#333'}, expectCode: 400, 
        expected: 'expect(res.body.message).to.equal("name is required")' },
      { it: 'name为数字', type: 'post', url:'/tags', args: {name:123, color: '#333'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('name is llegal')" },
      { it: 'name为特殊字符', type: 'post', url:'/tags', args: {name:'\t', color: '#333'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('exist llegal characters')" },
      // 非法color参数测试
      { it: 'color为空', type: 'post', url:'/tags', args: {name:'tag', color: ''}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('color is required')" },
      { it: 'color为非法格式', type: 'post', url:'/tags', args: {name:'tag', color: '#3'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('color is llegal')" },
      { it: 'color为非法格式', type: 'post', url:'/tags', args: {name:'tag', color: '#33'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('color is llegal')" },
      { it: 'color为小写', type: 'post', url:'/tags', args: {name:'tag', color: '#a3b3c3'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('color is llegal')" },
      // 测试alice 新建tag
      { it: 'alice创建Tag 0', type: 'post', url:'/tags', args: {name:'tag0', color: '#333'}, expectCode: 200, 
        expected: "expect(res.body.id).to.deep.equal(0);expect(res.body.name).to.deep.equal('tag0')" },
      { it: '查询Alice Tag', type: 'get', url:'/tags', args: {}, expectCode: 200, 
        expected: "expect(res.body.length).to.deep.equal(1)"},
      // 测试bob 新建tag
      { it: 'alice创建第二个Tag 1', type: 'post', url:'/tags', args: {name:'tag1', color: '#666'}, expectCode: 200, 
        expected: "expect(res.body.id).to.deep.equal(1);expect(res.body.name).to.deep.equal('tag1')" },
      { it: 'bob创建第一个Tag 2', type: 'post', url:'/tags', args: {name:'tag2', color: '#666'}, expectCode: 200, token: 'bob', 
        expected: "expect(res.body.id).to.deep.equal(2);expect(res.body.name).to.deep.equal('tag2')" },
      // 测试tag 是否pravite
      { it: '查询Alice Tag', type: 'get', url:'/tags', args: {}, expectCode: 200, 
        expected: "expect(res.body.length).to.deep.equal(2)"},
      { it: '查询BobTag', type: 'get', url:'/tags', args: {}, expectCode: 200,  token: 'bob',
        expected: "expect(res.body.length).to.deep.equal(1)"},
      // 测试 更新tag
      { it: '更新不存在 Tag 3', type: 'patch', url:'/tags/3', args: {name:'tag22', color: '#999'}, expectCode: 404, token: 'bob',
        expected: "expect(res.body.message).to.deep.equal('tag not found')" },
      { it: '更新不属于Bob Tag ', type: 'patch', url:'/tags/1', args: {name:'tag22', color: '#999'}, expectCode: 404, token: 'bob',
        expected: "expect(res.body.message).to.deep.equal('tag not found')" },
      { it: '更新 name参数为空', type: 'patch', url:'/tags/2', args: {name:'', color: '#999'}, expectCode: 400, token: 'bob',
        expected: "expect(res.body.message).to.equal('name is required')" },
      { it: '更新 name参数不合法', type: 'patch', url:'/tags/2', args: {name:123, color: '#999'}, expectCode: 400, token: 'bob',
        expected: "expect(res.body.message).to.equal('name is llegal')" },
      { it: '更新 name参数不合法', type: 'patch', url:'/tags/2', args: {name:'\t', color: '#999'}, expectCode: 400, token: 'bob',
        expected: "expect(res.body.message).to.equal('exist llegal characters')" },
      { it: '更新 color参数不合法', type: 'patch', url:'/tags/2', args: {name:'tag22a', color: ''}, expectCode: 400, token: 'bob',
        expected: "expect(res.body.message).to.equal('color is required')" },
      { it: '更新Bob Tag 2', type: 'patch', url:'/tags/2', args: {name:'tag22a', color: '#999'}, expectCode: 200, token: 'bob',
        expected: "expect(res.body.id).to.deep.equal(2);expect(res.body.name).to.deep.equal('tag22a')" },
      // 测试 删除tag
      { it: '删除不属于Bob Tag 0', type: 'delete', url:'/tags/0', expectCode: 404, token: 'bob', 
        expected: "expect(res.body.message).to.deep.equal('tag not found')" },
      { it: '删除不存在Tag 3', type: 'delete', url:'/tags/3', expectCode: 404, token: 'bob', 
        expected: "expect(res.body.message).to.deep.equal('tag not found')" },  
      { it: '删除Bob Tag 2', type: 'delete', url:'/tags/2', expectCode: 200, token: 'bob', 
        expected: "expect(res.body.length).to.deep.equal(0)" },
      { it: '删除Alice Tag 1', type: 'delete', url:'/tags/1', expectCode: 200, 
        expected: "expect(res.body.length).to.deep.equal(1)" },
      { it: '查询BobTag', type: 'get', url:'/tags', args: {}, expectCode: 200,  token: 'bob',
        expected: "expect(res.body.length).to.deep.equal(0)"},
      // 测试 tag是否为append-only
      { it: '新创建Bob Tag id应该为3 append-only', type: 'post', url:'/tags', args: {name:'tag3', color: '#666'}, expectCode: 200, token: 'bob', 
        expected: "expect(res.body.id).to.deep.equal(3);expect(res.body.name).to.deep.equal('tag3')" },
      { it: '新创建Alice Tag id应该为4 append-only', type: 'post', url:'/tags', args: {name:'tag4', color: '#666'}, expectCode: 200, 
        expected: "expect(res.body.id).to.deep.equal(4);expect(res.body.name).to.deep.equal('tag4')" },
    ]

    // for (let i = 4; i <= 3500; i++) {
    //   arr.push({
    //     it: '新创建Bob Tag id应该为' + i, type: 'post', url:'/tags', args: {name:'tag' + i, color: '#666'}, expectCode: 200, token: 'bob', 
    //     expected: `expect(res.body.id).to.deep.equal(${i});expect(res.body.name).to.deep.equal("tag${i}")`
    //   })

    //   arr.push({ 
    //     it: `查询BobTag 长度应该为${i - 2}`, type: 'get', url:'/tags', args: {}, expectCode: 200,  token: 'bob',
    //     expected: `expect(res.body.length).to.deep.equal(${i-2})`},)
    // }

    arr.forEach(item => {
      it(item.it, done => {
        let token = item.token? tokenBob: tokenAlice
        request(app.express)[item.type](item.url)
          .set('Authorization', 'JWT ' + token)
          .send(item.args)
          // .field('abc', {})
          .expect(item.expectCode)
          .end((err, res) => {
            // if (res.statusCode !== 200) console.log(res.body, err)
            eval(item.expected)
            done()
          })
      })
    })

  })

})
