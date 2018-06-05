const child = require('child_process')
const EventEmitter = require('events')
const readline = require('readline')
const { probe } = require('./storage')
const debug = require('debug')('udev')

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
      debug('*********************************')
      debug('********　Udev Message ***********')
      debug('*********************************')
      debug(t)
      this.emit('update', {action, blkpath})
    })

    this.rl.on('close', () => {
      debug('unexpected close of udev monitor')
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
    debug('*******************************************')
    debug(`********　Enter ${ this.constructor.name } state ***********`)
    debug('*******************************************')
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

    debug('*********************************')
    debug(`********　Start Probe ***********`)
    debug('*********************************')

    this.needProbe = 0
    probe(this.ctx.conf.storage, (err, data) => {
      if (data) this.ctx.emit('update', data)
      if (this.needProbe > 1) this.startProbing()
      else if ((this.needProbe === 1)) this.setState(Pending)
      else this.setState(Idle)
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
