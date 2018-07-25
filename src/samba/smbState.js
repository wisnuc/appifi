const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const EventEmitter = require('events')
const dgram = require('dgram')

const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))

const { rsyslogAsync, transfer, processUsersAsync, 
  processDrivesAsync, genSmbConfAsync } = require('./lib')

const debug = require('debug')('samba')

const rsyslogPath = '/etc/rsyslog.d/99-smbaudit.conf'

const isEnabled = (name, callback) => 
  child.exec(`systemctl is-enabled ${name}`, (err, stdout) => {
    if (err) {
      if (err.killed === false && 
        err.code === 1 && 
        err.signal === null && 
        stdout.trim() === 'disabled') {
        callback(null, false)
      } else {
        callback(err)
      }
    } else {
      if (stdout.trim() === 'enabled') {
        callback(null, true)
      } else {
        callback(new Error(`unknown state: ${stdout.trim()}`))
      }
    }
  })

const isEnabledAsync = Promise.promisify(isEnabled)

const isActive = (name, callback) => 
  child.exec(`systemctl is-active ${name}`, (err, stdout) => {
    if (err) {
      if (err.killed === false &&
        err.code === 3 &&
        err.signal === null &&
        stdout.trim() === 'inactive') {
        callback(null, false)
      } else {
        callback(err)
      }
    } else {
      if (stdout.trim() === 'active') {
        callback(null, true)
      } else {
        callback(new Error(`unknown state: ${stdout.trim()}`))
      }
    }
  })

const isActiveAsync = Promise.promisify(isActive)

class State {
  constructor(ctx, ...args) {
    this.ctx = ctx
    this.enter(...args)
    debug(`enter ${this.constructor.name} state`)
  }

  setState(State, ...args) {
    this.exit()
    this.ctx.state = new State(this.ctx, ...args)
  }

  enter() {}
  
  exit() {}

  start (callback) {
    let err = new Error('operation not permitted in current state')
    err.status = 403
    process.nextTick(() => callback(err))
  }

  stop (callback) {
    let err = new Error('operation not permitted in current state')
    err.status = 403
    process.nextTick(() => callback(err))
  }

  update () {}
}

class Detecting extends State {
  enter () {
    this.enterAsync()
      .then(x => this.setState(x ? Started : Stopped))
      .catch(e => this.setState(Failed, e))
  }

  // return boolean value indicating started (true) or stopped (false)
  async enterAsync () {
    if (!(await isEnabledAsync('smbd'))) return false
    await child.execAsync('systemctl start smbd')      
    return true
  }
}

class Starting extends State {
  enter (callback) {
    this.cbs = [callback]  
    this.startAsync()
      .then(() => {
        this.cbs.forEach(cb => cb(null))
        this.setState(Started)
      })
      .catch(e => {
        console.log('error starting smbd service', e.message)
        this.cbs.forEach(cb => cb(e))
        this.setState(Failed, e)
      })
  }

  async startAsync () {
    await child.execAsync('systemctl enable smbd') 
    await child.execAsync('systemctl start smbd')
  }

  start (callback) {
    this.cbs.push(callback)
  }
}

// state -> sub state, idle, pending, refreshing
// again -> refresh again
class Started extends State {
  enter () {
    this.timer = null
    this.again = false
    this.refresh() 
  }

  refresh () {
    debug('refreshing smb conf')
    this.state = 'refreshing'
    this.refreshAsync()
      .then(() => {})
      .catch(e => console.log('samba refresh error', e.message))
      .then(() => {
        if (this.exited) return
        if (this.again) {
          this.again = false
          this.state = 'pending'
          this.timer = setTimeout(() => this.refresh(), 500)
        } else {
          this.state = 'idle'
        }
      })
  }

  async refreshAsync () {
    let x = transfer(this.ctx.user.users, this.ctx.drive.drives)
    let users = await processUsersAsync(x.users)
    if (this.exited) return

    debug('refresh users', users)

    let drives = await processDrivesAsync(x.users, x.drives)
    if (this.exited) return

    debug('refresh drives', drives)

    await genSmbConfAsync(this.ctx.froot, users, drives, this.ctx.usbs)
    if (this.exited) return

    // theoretically, this command force all services to reload config (smbd, nmbd, winbindd etc)
    await child.execAsync('smbcontrol all reload-config')
  }

  exit () {
    if (this.state === 'refreshing') {
      this.exited = true
    } else if (this.state === 'pending') {
      clearTimeout(this.timer)
    } 
  }

  stop (callback) {
    this.setState(Stopping, callback)
  }

  update () {
    if (this.state === 'refreshing') {
      this.again = true
    } else if (this.state === 'pending') {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.refresh(), 500)
    } else {
      this.state = 'pending'
      this.timer = setTimeout(() => this.refresh(), 500) 
    }
  } 
}

class Stopping extends State {
  enter (callback) {
    this.cbs = [callback]
    child.exec('systemctl stop smbd', err => {
      if (err) {
        this.cbs.forEach(cb => cb(err))
        this.setState(Failed, err)
      } else {
        this.cbs.forEach(cb => cb(null))
        this.setState(Stopped)
      }
    })
  }

  stop (callback) {
    this.cbs.push(callback)
  }
}

class Stopped extends State {
  start (callback) {
    this.setState(Starting, callback)
  }

  stop (callback) {
    process.nextTick(() => callback(null))
  }
}

class Failed extends State {
  enter(err) { 
    debug('failed', err.message)
    this.error = err 
  }
}

class Samba extends EventEmitter {
  constructor(opts, user, drive, vfs, nfs) {
    super()
    this.froot = opts.fruitmixDir
    this.user = user
    this.drive = drive
    this.vfs = vfs
    this.nfs = nfs
    this.usbs = []

    this.nfs.on('usb', usbs => {
      this.usbs = usbs
      this.update() 
    })

    this.user.on('Update', () => this.update())
    this.drive.on('Update', () => this.update())

    // TODO this should be put in started state
    rsyslogAsync().then(() => {}).catch(e => console.log('error update rsyslog conf'))

    this.startUdpServer()
    this.state = new Detecting(this)

    console.log('samba module started')
  }

  update() {
    this.state.update()
  }

  stop() {
    this.state.stop(callback)
  }

  start (callback) {
    this.state.start(callback)
  }

  startUdpServer() {
    let udp = dgram.createSocket('udp4')
    this.udpServer = udp
    udp.on('listening', () => {
      const a = udp.address()
      console.log(`fruitmix udp listening ${a.address}:${a.port}`)
    })

    udp.on('message', (message, rinfo) => {
      const token = ' smbd_audit: '

      let text = message.toString()

      let tidx = text.indexOf(' smbd_audit: ')
      if (tidx === -1) return

      let arr = text.trim().slice(tidx + token.length).split('|')

      if (arr.length < 6 || arr[0] !== 'root' || arr[5] !== 'ok') return

      let user = arr[1]
      let share = arr[2]
      let abspath = arr[3]
      let op = arr[4]
      let arg0, arg1

      switch (op) {
        case 'create_file':
          if (arr.length !== 10) return
          if (arr[8] !== 'create') return
          if (arr[7] !== 'file') return
          arg0 = arr[9]
          break

        case 'mkdir':
        case 'rmdir':
        case 'unlink':
        case 'pwrite':
          if (arr.length !== 7) return
          arg0 = arr[6]
          break

        case 'rename':
          if (arr.length !== 8) return
          arg0 = arr[6]
          arg1 = arr[7]
          break

        case 'close':
          if (arr.lenght !== 7) return
          arg0 = arr[6]
          break

        default:
          return
      }

      let audit = { user, share, abspath, op, arg0 }
      if (arg1) audit.arg1 = arg1

      debug(audit)

      //TODO: emit message
      this.emit('SambaServerNewAudit', audit)
    })

    udp.on('error', err => {
      console.log('fruitmix udp server error', err)
      // should restart with back-off TODO
      //TODO: retry ？？
      udp.close()
      this.udpServer = undefined
    })

    udp.bind('3721', '127.0.0.1', ()=>{})
  }

  GET(user, props, callback) {
    callback(null, { state: this.state.constructor.name })
  }

  PATCH (user, props, callback) {
    if (props.op === 'start') {
      this.state.start(callback)
    } else if (props.op === 'stop') {
      this.state.stop(callback)
    } else {
      let err = new Error('invalid op')
      err.status = 400
      process.nextTick(() => callback(err))
    }
  }

}

module.exports = Samba

