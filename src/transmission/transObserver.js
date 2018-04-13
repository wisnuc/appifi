const EventEmitter = require('events')
const autoWorkTime = 2000

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

  enter() {}
  exit() {}
}

class Pending extends State {
  // 自动进入working状态
  enter() {
    // console.log('enter pending state')
    this.timer = setTimeout(() => this.setState(Working), autoWorkTime)
  }

  // 清理timer
  exit() {
    clearTimeout(this.timer)
  }

  // 主动进入working状态
  get(id, callback) {
    this.setState(Working, [{ id, callback }], 222)
  }
}

class Working extends State {
  enter(queue = []) {
    // console.log('enter working state')
    this.queue = queue
    this.next = []
    this.ctx.container.client.get((err,arg) => {
      if (err) this.queue.forEach(({ id, callback }) => callback(err) )
      else {
        // 同步transmission 列表
        this.ctx.emit('update', arg)
        this.queue.forEach(({ id, callback }) => callback())
      }

      if (this.next.length) {
        this.setState(Working, this.next)
      } else this.setState(Pending)
    })
  }

  get(id, callback) {
    this.next.push({ id, callback })
  }
}

class TransOberver extends EventEmitter {
  constructor(container) {
    super()
    this.container = container
    new Pending(this)
  }

  get(id, callback) {
    this.state.get(id, callback)
  }
}

module.exports = TransOberver

