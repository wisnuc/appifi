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

describe(path.basename(__filename), () => {
  let fruitmix, app, tokenAlice, tokenBob

  // 初始化APP
  const initApp = done => {
    fruitmix = new Fruitmix({ fruitmixDir })
    app = new App({ fruitmix })
    fruitmix.on('FruitmixStarted', async () => {
      tokenAlice = await requestTokenAsync(app.express, USERS.alice.uuid, 'alice')
      tokenBob = await requestTokenAsync(app.express, USERS.bob.uuid, 'bob')
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
      { it: 'name为空字符串', type: 'post', url:'/tags', args: {name:'', color: '#333'}, expectCode: 400, 
        expected: 'expect(res.body.message).to.equal("name is required")' },
      { it: 'name为数字', type: 'post', url:'/tags', args: {name:123, color: '#333'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('name should be string')" },
      { it: 'name为特殊字符', type: 'post', url:'/tags', args: {name:'\t', color: '#333'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('exist llegal characters')" },
      { it: 'color为空', type: 'post', url:'/tags', args: {name:'tag', color: ''}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('color is required')" },
      { it: 'color为非法格式', type: 'post', url:'/tags', args: {name:'tag', color: '#3'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('color is llegal')" },
      { it: 'color为非法格式', type: 'post', url:'/tags', args: {name:'tag', color: '#33'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('color is llegal')" },
      { it: 'color为小写', type: 'post', url:'/tags', args: {name:'tag', color: '#a3b3c3'}, expectCode: 400, 
        expected: "expect(res.body.message).to.equal('color is llegal')" },
      { it: 'alice创建Tag 0', type: 'post', url:'/tags', args: {name:'tag0', color: '#333'}, expectCode: 200, 
        expected: "expect(res.body.id).to.deep.equal(0);expect(res.body.name).to.deep.equal('tag0')" },
      { it: '查询Alice Tag', type: 'get', url:'/tags', args: {}, expectCode: 200, 
        expected: "expect(res.body.length).to.deep.equal(1)"},
      { it: 'alice创建第二个Tag 1', type: 'post', url:'/tags', args: {name:'tag1', color: '#666'}, expectCode: 200, 
        expected: "expect(res.body.id).to.deep.equal(1);expect(res.body.name).to.deep.equal('tag1')" },
      { it: 'bob创建第一个Tag 2', type: 'post', url:'/tags', args: {name:'tag2', color: '#666'}, expectCode: 200, token: 'bob', 
        expected: "expect(res.body.id).to.deep.equal(2);expect(res.body.name).to.deep.equal('tag2')" },
      { it: '查询Alice Tag', type: 'get', url:'/tags', args: {}, expectCode: 200, 
        expected: "expect(res.body.length).to.deep.equal(2)"},
      { it: '查询BobTag', type: 'get', url:'/tags', args: {}, expectCode: 200,  token: 'bob',
        expected: "expect(res.body.length).to.deep.equal(1)"},
      { it: '更新Bob Tag 2', type: 'patch', url:'/tags/2', args: {name:'tag22', color: '#999'}, expectCode: 200, token: 'bob',
        expected: "expect(res.body.id).to.deep.equal(2);expect(res.body.name).to.deep.equal('tag22')" },
      { it: '删除不属于Bob Tag 0', type: 'delete', url:'/tags/0', expectCode: 404, token: 'bob', 
        expected: "expect(res.body.message).to.deep.equal('tag not found')" },
      { it: '删除不存在Tag 3', type: 'delete', url:'/tags/3', expectCode: 404, token: 'bob', 
        expected: "expect(res.body.message).to.deep.equal('tag not found')" },  
      { it: '删除Bob Tag 2', type: 'delete', url:'/tags/2', expectCode: 200, token: 'bob', 
        expected: "expect(res.body.length).to.deep.equal(0)" },
      { it: '查询BobTag', type: 'get', url:'/tags', args: {}, expectCode: 200,  token: 'bob',
        expected: "expect(res.body.length).to.deep.equal(0)"},
      { it: '新创建Bob Tag id应该为3', type: 'post', url:'/tags', args: {name:'tag3', color: '#666'}, expectCode: 200, token: 'bob', 
        expected: "expect(res.body.id).to.deep.equal(3);expect(res.body.name).to.deep.equal('tag3')" },
    ]

    arr.forEach(item => {
      it(item.it, done => {
        let token = item.token? tokenBob: tokenAlice
        request(app.express)[item.type](item.url)
          .set('Authorization', 'JWT ' + token)
          .send(item.args)
          .expect(item.expectCode)
          .end((err, res) => {
            if (err) console.log(err)
            eval(item.expected)
            done()
          })
      })
    })
  })

})
