const child = require('child_process')
const EventEmitter = require('events')
const readline = require('readline')
const { probe } = require('./storage')

class UdevMonitor extends EventEmitter {
  constructor () {
    super()
    this.startMonitor()
  }

  startMonitor() {
    if (this.rl && !this.rl.closed) this.rl.close()
    if (this.spawn && !this.spawn.killed) this.spawn.kill()

    this.spawn = child.spawn('stdbuf', ['-oL', 'udevadm', 'monitor', '--udev', '-s', 'block'])
    this.rl = readline.createInterface({ input: spawn.stdout })
    this.timer = -1
    this.queue = []

    rl.on('line', line => {
      let t = line.trim()
      if (!t.endsWith('(block)')) return

      let split = t.split(' ')
        .map(x => x.trim())
        .filter(x => !!x.length)

      if (split.length !== 5 ||
        split[0] !== 'UDEV' ||
        (split[2] !== 'add' && split[2] !== 'remove') ||
        split[4] !== '(block)') { return }

      let action = split[2]
      let blkpath = split[3]

      if (this.timer !== -1) { clearTimeout(this.timer) }

      this.queue.push({action, blkpath})
      this.timer = setTimeout(() => {
        this.emit('update', this.queue)
        this.queue = []
        this.timer = -1
      }, 150)
    })

    rl.on('close', () => {
      console.log('unexpected close of udev monitor')
      // restart after 5 seconds
      setTimeout(() => this.startMonitor(), 5 * 1000)
    })
  }

  destroy() {
    if (this.rl && !this.rl.closed) this.rl.close()
    if (this.spawn && !this.spawn.killed) this.spawn.kill()
    this.rl = null
    this.spawn = null
  }

}


class State {
  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  setState (State, ...args) {
    this.exit()
    new State(this.ctx, ...args)
  }

  probe() {

  }
}

class Idle {
  enter () {

  }

  probe () {
    this.setState(Pending)
  }
}

class Pending {
  enter () {
    this.timer = setTimeout(() => {
      this.setState(Probing)
    }, 5000)
  }

  probe () {
    this.setState(Probing)
  }

  exit () {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}

class Probing {

  enter() {
    this.needProbe = false
    probe(this.ctx.conf.storage, (err, data) => {
      if (data) this.ctx.emit('update', data)
      this.setState(this.needProbe ? Pending : Probing)
    })
  }

  exit() {

  }

  probe() {
    this.needProbe = true
  }
}

class StorageUpdater extends EventEmitter {
  constructor(conf) {
    super()
    this.conf = conf
    new Idle()
  }

  probe() {
    this.state.probe()
  }
}

module.exports = {
  UdevMonitor,
  StorageUpdater
}
