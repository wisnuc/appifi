const EventEmitter = require('events')
const debug = require('debug')('transmission')
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
    // debug(`observer enter ${NextState.valueOf().name}`)
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
  get(task, callback) {
    this.setState(Working, [{ task, callback }], 222)
  }
}

class Working extends State {
  enter(queue = []) {
    // console.log('enter working state')
    this.queue = queue
    this.next = []
    this.ctx.container.client.get((err,arg) => {
      if (err) {
        console.log(`transmission error in observer`)// todo
        this.queue.forEach(({ task, callback }) => callback(err) )
      }
      else {
        // 同步transmission 列表
        this.ctx.emit('update', arg)
        this.queue.forEach(({ task, callback }) => {
          let taskObject = arg.torrents.find(item => item.id == task.id)
          if (!taskObject) return callback(new Error('can not found task after operation'))
          if (!task.limit) callback(null, task)
          else {
            // console.log('task should observe status')
            // console.log(`task id is ${task.id} status should be ${task.status}  status is ${taskObject.status} limit is ${task.limit} times is ${task.times}`)
            if (taskObject.status == task.status) callback(null, task)
            else {
              task.times++
              if (task.times == task.limit) return callback(new Error('task status error after limit querys'))
              this.next.push({ task, callback })
            }
          }
        })
      }

      if (this.next.length) {
        setTimeout(() => { this.setState(Working, this.next) }, 150)
      } else this.setState(Pending)
    })
  }

  get(task, callback) {
    this.next.push({ task, callback })
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

