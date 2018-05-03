const Promise = require('bluebird')
const path = require('path')
const events = require('events')
const dgram = require('dgram')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const { rsyslogAsync, transfer, processUsersAsync, 
  processDrivesAsync, genSmbConfAsync } = require('./lib')

const debug = require('debug')('samba')

const rsyslogPath = '/etc/rsyslog.d/99-smbaudit.conf'

const nosmb = !!process.argv.find(arg => arg === '--disable-smb') || process.env.NODE_PATH !== undefined

// samba 服务
class SambaServer extends events.EventEmitter {
  constructor(opts, user, drive) {
    super()
    this.froot = opts.fruitmixDir
    this.user = user
    this.drive = drive
    this.udpServer = undefined
    new Pending(this)
    this.user.on('Update', (data) => {
      console.log(data)
    })
    // console.log(user.LIST())

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
      // this.driveList.audit(abspath, arg0, arg1)
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

  start(users, drives) {
    this.state.setState(Initialize, users, drives)
  }

  stop() {
    this.state.setState(Pending)
  }
}

class State {
  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  setState(NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter() {}
  
  exit() {}
}

class Pending extends State {
  enter() { this.name = 'pending' }
}

class Working extends State {
  enter() { this.name = 'working' }
  
  async exit() {
    await child.execAsync('systemctl stop smbd')
    await child.execAsync('systemctl stop nmbd')
  }
}

class Initialize extends State {
  // 启动samba服务
  async enter(users, drives) {
    this.name = 'initialize'
    await rsyslogAsync()
    let x = transfer(users, drives)
    let userArr = await processUsersAsync(x.users)
    let driveArr = await processDrivesAsync(x.users, x.drives)
    await genSmbConfAsync(this.ctx.froot, userArr, driveArr)
    await child.execAsync('systemctl enable nmbd')
    await child.execAsync('systemctl enable smbd')
    await child.execAsync('systemctl restart smbd')
    await child.execAsync('systemctl restart nmbd')
    this.setState(Working)
  }
}

module.exports = SambaServer

