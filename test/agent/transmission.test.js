const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
const { spawn, spawnSync } = require('child_process')
const { expect } = require('chai')
const sinon = require('sinon')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const Manager = require('../../src/transmission/manager')
const { Init, Working, Failed } = require('../../src/transmission/transStateMachine')
const TransmissionMethod = require('../../src/lib/transmission')

const testPath = path.join('/home/liu/Downloads/transmissionTest')
const taskObj1 = { id: '1', dirUUID: '1', userUUID: '1'}
const taskObj2 = { id: '2', dirUUID: '2', userUUID: '2', name: '2', finishTime: (new Date()).getTime()}
const magnetUrl = 'magnet:?xt=urn:btih:61cf2a75570474bb3ac4894cdbc8f79917335009&dn=%e9%98%b3%e5%85%89%e7%94%b5%e5%bd%b1www.ygdy8.com.%e7%8e%8b%e7%89%8c%e7%89%b9%e5%b7%a52%ef%bc%9a%e9%bb%84%e9%87%91%e5%9c%88.BD.720p.%e5%9b%bd%e8%8b%b1%e5%8f%8c%e8%af%ad%e5%8f%8c%e5%ad%97.mkv&tr=udp%3a%2f%2ftracker.leechers-paradise.org%3a6969%2fannounce&tr=udp%3a%2f%2feddie4.nl%3a6969%2fannounce&tr=udp%3a%2f%2fshadowshq.eddie4.nl%3a6969%2fannounce&tr=udp%3a%2f%2ftracker.opentrackr.org%3a1337%2fannounce'

describe('初始化状态测试', () => {
  class FakeManager extends EventEmitter {
    constructor() {
      super()
      this.downloaded = []
      this.downloading = []
    }
  }

  let instance = null

  beforeEach(() => {
    instance = new FakeManager()
  })

  
  it('初始化成功', (done) => {
    instance.on('stateChange', () => {
      expect(instance.state.name).to.be.equal('working')
      done()
    })

    new Init(instance)
  })

  it('transmission 进程获取错误', (done) => {
    let stub = sinon.stub(TransmissionMethod, 'getEnableState').returns('test error result')
    instance.on('stateChange', () => {
      expect(instance.state.name).to.be.equal('failed')
      stub.restore()
      done()
    })

    new Init(instance)
  })

  it('transmission 实例错误', (done) => {
    
  })
})





return
describe('初始化测试', () => {
  before(() => {
    mkdirp(testPath)
  })
  
  after((done) => {
    rimraf(testPath, (err, data) => {done()})
  })

  describe('没有存储记录的初始化', () => {
    let command = 'systemctl'
    let serviceName = 'transmission-daemon'
    let manager
    
    before(async () => {  
      manager = new Manager(testPath)
      await manager.init()
    })

    it('服务可用', () => {
      let enableResult = spawnSync(command, ['is-enabled', serviceName]).stdout.toString()
      expect(enableResult).to.include('enabled')
    })

    it('服务运行', () => {
      let activeResult = spawnSync(command, ['is-active', serviceName]).stdout.toString()
      expect(activeResult).to.include('active')
    })

    it('实例存在', () => {
      expect(manager.client).not.to.be.null
      expect(manager.tempPath).to.be.equal(testPath)
    })
  })
  
  describe('带有存储记录的初始化', () => {
    let manager
    let downloading = [taskObj1]
    let downloaded = [taskObj2]
    let storage = { downloading, downloaded }
    let storagePath = path.join(testPath, 'storage.json')

    before(async () => {
      fs.writeFileSync(storagePath, JSON.stringify(storage, null, '\t'))
      manager = new Manager(testPath)
      await manager.init()
    })

    it('任务列表中存在一个任务', () => {
      expect(manager.downloading.length).equal(1)
      expect(manager.downloading[0]).include(downloading[0])
    })

    it('完成列表中存在一个任务', () => {
      expect(manager.downloaded.length).equal(1)
      expect(manager.downloaded[0]).include(downloaded[0])
    })
  })
})
return
describe('任务测试', () => {
  let manager, id
  before(() => {
    mkdirp(testPath)
  })

  after((done) => {
    rimraf(testPath, (err, data) => {done()})
  })

  describe('创建磁链任务', () => {
    before(async () => {  
      manager = new Manager(testPath)
      await manager.init()
      manager.syncList()
    })
    
    after(() => {
      manager.clearSync()
    })

    it('创建任务', async () => {
      let result = await manager.createTransmissionTask('magnet', magnetUrl, '1', '1')
      id = result.id
      expect(result).to.have.property('id')
    })

    it('创建相同任务', done => {
      manager.createTransmissionTask('magnet', magnetUrl, '1', '1').then(() => {
        throw new Error('same task should be failed')
      }).catch(e => {done()})
    })

    it('根据ID查询任务-状态为4', async () => {
      let result = await manager.get(id)
      expect(result).to.be.an('object').that.have.keys(['torrents'])
      expect(result).to.nested.include({'torrents[0].status': 4})
    })
  })

  describe('暂停任务', () => {
    it('暂停任务', done => {
      manager.op(id, '1', 'pause', (err, data) => {
        if (err) done(err)
        else done()
      })
    })

    it('暂停任务-状态为0', done => {
      setTimeout(async () => {
        try {
          let result = await manager.get(id)
          expect(result).to.nested.include({'torrents[0].status': 0})
          done()
        }catch (e) { done(e)} 
      },500)
    })
  })

  describe('继续任务', () => {
    it('继续任务', done => {
      manager.op(id, 1, 'resume', (err, data) => {
        if (err) done(err)
        else done()
      })
    })

    it('继续任务-状态为4', done => {
      setTimeout(async () => {
        try {
          let result = await manager.get(id)
          expect(result).to.nested.include({'torrents[0].status': 4})
          done()
        }catch (e) { done(e)} 
      },0)
    })
  
  })

  
  describe('删除任务', () => {
    it('删除任务', done => {
      manager.op(id, '1', 'destroy', async (err, data) => {
        if (err) done(err)
        else done()
      })
    })

    it('任务列表中不存在已删除任务', () => {
      let result = manager.getList()
      let index = result.downloading.findIndex(item => item.id == id)
      expect(index).to.be.equal(-1)
    })
  })
})