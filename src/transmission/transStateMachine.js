const fs = require('fs')
const { spawn, spawnSync } = require('child_process')
const Transmission = require('transmission')
const bluebird = require('bluebird')
const Task = require('./task')
bluebird.promisifyAll(fs)


class State {
  constructor(ctx, ...args) {
    // 重置CTX状态对象
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  // 设置新态
  setState(NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
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
      throw new Error('test err')
      // 检查服务状态
      let enableResult = spawnSync(command, ['is-enabled', serviceName]).stdout.toString()
      let activeResult = spawnSync(command, ['is-active', serviceName]).stdout.toString()
      if (enableResult.indexOf('enabled') === -1) return this.setState(Failed, this.ctx, enableResult.stderr.toString())
      if (activeResult.indexOf('active') === -1) return this.setState(Failed, this.ctx, enableResult.stderr.toString())
      // 实例化Transmission
      this.ctx.client = new Transmission({
        host: 'localhost',
        port: 9091,
        username: 'transmission',
        password: '123456'
      })
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
    } catch (error) { this.setState(Failed, error, 1, 2, 3) }
  }
}

class Working extends State {
  constructor(ctx) {
    super(ctx)
    this.name = 'working'
  }

  enter() {
    console.log('enter work state')
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