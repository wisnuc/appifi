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
    this.rl = readline.createInterface({ input: this.spawn.stdout })

    this.rl.on('line', line => {
      let t = line.trim()
      console.log(t)
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
      console.log('*********************************')
      console.log('********　Udev Message ***********')
      console.log('*********************************')
      this.emit('update', {action, blkpath})
    })

    this.rl.on('close', () => {
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
    console.log('*******************************************')
    console.log(`********　Enter ${ this.constructor.name } state ***********`)
    console.log('*******************************************')
    this.enter(...args)
  }

  setState (State, ...args) {
    this.exit()
    new State(this.ctx, ...args)
  }

  probe() {

  }

  exit() {

  }

  enter () {

  }
}

class Idle extends State {
  enter () {

  }

  probe () {
    this.setState(Pending)
  }
}

class Pending extends State {
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

class Probing extends State {

  enter() {
    this.startProbing()
  }

  startProbing() {

    console.log('*********************************')
    console.log(`********　Start Probe ***********`)
    console.log('*********************************')

    this.needProbe = 0
    probe(this.ctx.conf.storage, (err, data) => {
      if (data) this.ctx.emit('update', data)
      if (this.needProbe > 1) this.startProbing()
      else {
        this.setState(Pending)
      }
    })
  }

  exit() {

  }

  probe() {
    this.needProbe ++
  }
}

class StorageUpdater extends EventEmitter {
  constructor(conf) {
    super()
    this.conf = conf
    new Idle(this)
  }

  probe() {
    this.state.probe()
  }
}

module.exports = {
  UdevMonitor,
  StorageUpdater
}
