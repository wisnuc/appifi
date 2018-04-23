const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const request = require('supertest')
const chai = require('chai')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const Fruitmix = require('../../../src/fruitmix/Fruitmix')
const Auth = require('../../../src/middleware/Auth')
const createTokenRouter = require('../../../src/routes/Token')
const createUserRouter = require('../../../src/routes/users')
const createTransmissionRouter = require('../../../src/transmission')
const createExpress = require('../../../src/system/express')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const magnet1 = 'magnet:?xt=urn:btih:61cf2a75570474bb3ac4894cdbc8f79917335009&dn=%e9%98%b3%e5%85%89%e7%94%b5%e5%bd%b1www.ygdy8.com.%e7%8e%8b%e7%89%8c%e7%89%b9%e5%b7%a52%ef%bc%9a%e9%bb%84%e9%87%91%e5%9c%88.BD.720p.%e5%9b%bd%e8%8b%b1%e5%8f%8c%e8%af%ad%e5%8f%8c%e5%ad%97.mkv&tr=udp%3a%2f%2ftracker.leechers-paradise.org%3a6969%2fannounce&tr=udp%3a%2f%2feddie4.nl%3a6969%2fannounce&tr=udp%3a%2f%2fshadowshq.eddie4.nl%3a6969%2fannounce&tr=udp%3a%2f%2ftracker.opentrackr.org%3a1337%2fannounce'
describe(__filename, () => {
  // fruitmix实例
  let fruitmix

  // 创建APP实例方法
  const createApp = () => {
    fruitmix = new Fruitmix({ fruitmixDir })
    let auth = new Auth('some secret', () => fruitmix.users)
    let token = createTokenRouter(auth)
    let users = createUserRouter(auth, () => fruitmix)
    let transmission = createTransmissionRouter(auth, fruitmix)

    let opts = {
      auth: auth.middleware,
      settings: { json: { spaces: 2 } },
      log: { skip: 'all', error: 'all' },
      routers: [
        ['/token', token],
        ['/users', users],
        ['/transmission', transmission]
      ]
    }

    return createExpress(opts)
  }

  // 获取token
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

  // 查询transmission 
  const requestTransmission = (app, token, callback) => {
    request(app)
      .get('/transmission')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) callback(err)
        else callback(null, res.body)
      })
  }

  // 创建transmission 任务
  const createMagnetTask = (app, token, magnetURL, dirUUID, callback) => {
    request(app)
      .post('/transmission/magnet')
      .set('Authorization', 'JWT ' + token)
      .send({ magnetURL, dirUUID})
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        else callback(null, res.body)
      })
  }

  const init = async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(fruitmixDir)
    let usersFile = path.join(fruitmixDir, 'users.json')
    await fs.writeFileAsync(usersFile, JSON.stringify([alice, bob], null, '  '))
  }

  // 测试token
  describe('test token', () => {
    beforeEach(init)

    it('should retrieve toke (no assert)', done => {
      let app = createApp()
      fruitmix.once('FruitmixStarted', () =>
        request(app)
          .get('/token')
          .auth(alice.uuid, 'alice')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            done()
          }))
    })
  })

  // 测试查询API
  describe('test get transmission', () => {
    beforeEach(init)

    it('should get 200', done => {
      let app = createApp()
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app, alice.uuid, 'alice', (err, token) => {
          if (err) return done(err)
          requestTransmission(app, token, (err, data) => {
            if (err) done(err)
            else done()
          })
        })
      })
    })
  })

  // 测试创建API
  describe('test create magnet task', () => {
    let app, token, id
    before(init)

    // 创建 返回 code 200
    it('should get 200', done => {
      app = createApp()
      fruitmix.once('FruitmixStarted', () => {
        requestToken(app, alice.uuid, 'alice', (err, data) => {
          if (err) return done(err)
          token = data
          createMagnetTask(app, token, magnet1, 'testUUID', (err, result) => {
            if (err) return done(err)
            id = result.id
            done()
          })
        })
      })
    })

    // 检查任务列表中是否包含 刚才创建的任务ID
    it('task list should incluede task own id', done => {
      requestTransmission(app, token, (err, result) => {
        if (err) return done(err)
        let index = result.downloading.findIndex(item => item.id == id)
        if (index !== -1) done()
        else done(new Error('can not found task'))
      })
    })
  })
  
  // 测试操作API
  describe('test task operation', () => {
    let app, token, id
    // 创建一个被操作任务
    before((done) => {
      init().then(() => {
        app = createApp()
        fruitmix.once('FruitmixStarted', () => {
          requestToken(app, alice.uuid, 'alice', (err, data) => {
            if (err) return done(err)
            token = data
            createMagnetTask(app, token, magnet1, 'testUUID', (err, result) => {
              if (err) return done(err)
              id = result.id
              done()
            })
          })
        })
      })
      
    })

    // 暂停 返回 code 200
    it('pause task should return 200', done => {
      request(app)
        .patch(`/transmission/${id}`)
        .set('Authorization', 'JWT ' + token)
        .send({op: 'pause'})
        .expect(200)
        .end((err, res) => {
          if (err) done(err)
          else done()
        })
    })

    // 检查任务status 是否为0
    it('task status should be 0', done => {
      requestTransmission(app, token, (err, result) => {
        if (err) return done(err)
        let task = result.downloading.find(item => item.id == id)
        if (!task) return done(new Error('can not found task '))
        if (task.status !== 0) return done(new Error('task status is not 0'))
        done()
      })
    })

    // 续传 返回 code 200
    it('resume task should return 200', done => {
      request(app)
        .patch(`/transmission/${id}`)
        .set('Authorization', 'JWT ' + token)
        .send({op: 'resume'})
        .expect(200)
        .end((err, res) => {
          if (err) done(err)
          else done()
        })
    })

    // 检查任务status 是否为4
    it('task status should be 4', done => {
      requestTransmission(app, token, (err, result) => {
        if (err) return done(err)
        let task = result.downloading.find(item => item.id == id)
        if (!task) return done(new Error('can not found task '))
        if (task.status !== 4) return done(new Error(`task status is ${task.status}`))
        done()
      })
    })

    // 删除 返回 code 200
    it('delete task should return 200', done => {
      requestTransmission(app, token, (err, result) => {
        if (err) return done(err)
        let task = result.downloading.find(item => item.id == id)
        let uuid = task.uuid
        request(app)
        .patch(`/transmission/${id}`)
        .set('Authorization', 'JWT ' + token)
        .send({op: 'destroy', uuid})
        .expect(200)
        .end((err, res) => {
          if (err) done(err)
          else done()
        })
      })
    })

    // 检查任务列表是否为空
    it('task list length should be 0', done => {
      requestTransmission(app, token, (err, result) => {
        if (err) return done(err)
        if (result.downloading.length == 0) done()
        else done(new Error('task list length is not 0'))
      })
    })
    
  })
})


const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  phicommUserId: 'alice'
}

const bob = {
  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
  username: 'bob',
  isFirstUser: false,
  password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
  smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'bob'
}

const charlie = {
  uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
  username: 'charlie',
  password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
  smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'charlie'
}
