const fs = require('fs')
const { spawn, spawnSync } = require('child_process')
const Transmission = require('transmission')
const bluebird = require('bluebird')
const Task = require('./task')
const lib = require('../lib/transmission')
const debug = require('debug')('transmission')
const EventEmitter = require('events')
bluebird.promisifyAll(fs)


class State extends EventEmitter {
  constructor(ctx, ...args) {
    super()
    // 重置CTX状态对象
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  // 设置新态
  setState(NextState, ...args) {
    this.exit()
    debug(`manager enter ${NextState.valueOf().name}`)
    new NextState(this.ctx, ...args)
    this.ctx.emit('stateChange')
  }

  enter() { }
  exit() { }
}

class Init extends State {
  constructor(ctx) {
    super(ctx)
    this.name = 'init'
  }

  async enter() {
    // 检查transmission-daemon 
    try {
      let command = 'systemctl'
      let serviceName = 'transmission-daemon'
      // 尝试启动服务
      spawnSync(command, ['enable', serviceName])
      spawnSync(command, ['start', serviceName])
      // 检查服务状态
      let enableResult = lib.getEnableState()
      let activeResult = lib.getActiveState()
      if (enableResult.indexOf('enabled') === -1) return this.setState(Failed, this.ctx, enableResult.toString())
      if (activeResult.indexOf('active') === -1) return this.setState(Failed, this.ctx, enableResult.toString())
      // 实例化Transmission
      this.ctx.client = lib.getTransmission('localhost', 9091, 'transmission', '123456')
      bluebird.promisifyAll(this.ctx.client)
      // 设置transmission属性
      await this.ctx.client.sessionAsync({
        seedRatioLimit: 5,
        seedRatioLimited: false,
        'speed-limit-up-enabled': false,
        'speed-limit-down-enabled': false
      })

      // 读取缓存文件， 创建未完成任务
      if (!fs.existsSync(this.ctx.storagePath)) return this.setState(Working, this.ctx, Working)
      let tasks = JSON.parse(fs.readFileSync(this.ctx.storagePath))

      this.ctx.downloaded = tasks.downloaded.map(task => {
        let { id, users, name } = task
        return new Task(id, users, name, this.ctx, true)
      })

      this.ctx.downloading = tasks.downloading.map(task => {
        let { id, users } = task
        return new Task(id, users, '', this.ctx, false)
      })

      this.setState(Working, this.ctx, Working)
    } catch (error) { this.setState(Failed, error) }
  }

  exit() {
    this.emit('Working')
  }
}

class Working extends State {
  constructor(ctx) {
    super(ctx)
    this.name = 'working'
  }

  enter() {
    this.emit('Working')
  }
}

class Failed extends State {
  constructor(ctx, ...args) {
    super(ctx, ...args)
    this.name = 'failed'
  }

  enter(error) {
    this.error = typeof error === 'object' ? error : new Error(error)
    this.ctx.client = null
    console.log('enter failed state')
  }

  restart() {

  }
}

module.exports = { Init, Working, Failed }