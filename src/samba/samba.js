const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const EventEmitter = require('events')
const dgram = require('dgram')

const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))

// const { processUsersAsync, genSmbConfAsync } = require('./lib')

const debug = require('debug')('samba')

const rsyslogPath = '/etc/rsyslog.d/99-smbaudit.conf'

// 调用rsyslog服务，记录samba信息
const rsyslogAsync = async () => {
  const text = 'LOCAL7.*    @127.0.0.1:3721'

  let data
  try {
    data = await fs.readFileAsync(rsyslogPath)
    if (data.toString() === text) return
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }

  await fs.writeFileAsync(rsyslogPath, text)

  try {
    await child.execAsync('systemctl restart rsyslog')
  } catch (e) {
    console.log('rsyslogd restart error, neglected', e)
  }
}

/**
retrieve linux users from /etc/passwd
*/
const retrieveSysUsersAsync = async () => {
  let data = await fs.readFileAsync('/etc/passwd')
  return data.toString().split('\n')
    .map(l => l.trim())
    .filter(l => l.length)
    .map(l => {
      let split = l.split(':')
      if (split.length !== 7) return null
      return {
        name: split[0],
        id: parseInt(split[2])
      }
    })
    .filter(u => !!u)
    .filter(u => /^x[0-9a-f]{31}$/.test(u.name)) // 31位长度的用户名是NAS用户对应UUID
}

/**
retrieve smb users using pdbedit
*/
const retrieveSmbUsersAsync = async () => {
  let stdout = await child.execAsync('pdbedit -Lw')
  return stdout.toString().split('\n')
    .map(l => l.trim())
    .filter(l => l.length)
    .map(l => {
      let split = l.split(':')
      if (split.length !== 7) return null
      return {
        name: split[0],
        uid: parseInt(split[1]),
        md4: split[3],
        lct: split[5]
      }
    })
    .filter(u => !!u)
}


// this function
// 1. sync /etc/passwd,
// 2. sync smb passwd db,
// 3. generate user map
// returns users
const processUsersAsync = async _users => {
  // filter out users without smb password
  users = _users.filter(u => !!u.smbPassword)

  // 获取与本地用户对于的系统用户列表
  let sysUsers = await retrieveSysUsersAsync()
  debug('get system users\n')
  debug(sysUsers)

  // 将系统用户删除
  let outdated = sysUsers.filter(su => !users.find(fu => fu.unixName === su.name))
  for (let i = 0; i < outdated.length; i++) {
    try {
      await child.execAsync(`deluser ${outdated[i].name}`)
    } catch (e) {
      console.log(`error deleting user ${outdated[i].name}`)
    }
  }

  debug('after remove system users')

  // 将本地用户添加至系统用户
  let newNames = users
    .filter(fu => !sysUsers.find(su => su.name === fu.unixName))
    .map(fu => fu.unixName)

  for (let i = 0; i < newNames.length; i++) {
    try {
      let cmd = 'adduser --disabled-password --disabled-login --no-create-home --gecos ",,," ' +
        `--gid 65534 ${newNames[i]}`
      await child.execAsync(cmd)
    } catch (e) {
      console.log(`error adding user ${newNames[i]}`)
    }
  }

  debug('after add system users')

  // 将新生成的系统用户ID赋予本地用户
  sysUsers = await retrieveSysUsersAsync()
  users = users.reduce((acc, fu) => {
    let su = sysUsers.find(su => su.name === fu.unixName)
    if (su) {
      fu.unixUID = su.id
      acc.push(fu)
    }
    return acc
  }, [])

  // 获取现有的samba用户
  let smbUsers = await retrieveSmbUsersAsync()

  debug('get samba users')
  debug(smbUsers)

  // 删除现有的samba用户
  for (let i = 0; i < smbUsers.length; i++) {
    try {
      await child.execAsync(`pdbedit -x ${smbUsers[i].name}`)
    } catch (e) {
      console.log(`error deleting smb user ${smbUsers[i].name}`)
    }
  }

  debug('after remove samba user')

  // 创建samba用户
  let text = users
    .map(u => {
      return [
        `${u.unixName}`,
        `${u.unixUID}`,
        'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        `${u.smbPassword.toUpperCase()}`,
        '[U          ]',
        `LCT-${Math.floor(u.lastChangeTime / 1000).toString(16).toUpperCase()}`
      ].join(':')
    })
    .join('\n')

  await mkdirpAsync('/run/wisnuc/smb')
  await fs.writeFileAsync('/run/wisnuc/smb/tmp', text)
  await child.execAsync('pdbedit -i smbpasswd:/run/wisnuc/smb/tmp')
  await rimrafAsync('/run/wisnuc/smb')

  debug('after create samba user')

  // creat user map
  text = users
    .map(u => `${u.unixName} = "${u.phoneNumber}"`)
    .join('\n')

  await fs.writeFileAsync('/etc/smbusermap', text)
  return users
}

// smb.conf global section
const globalSection = `
[global]
  username map = /etc/smbusermap
  workgroup = WORKGROUP
  netbios name = SAMBA
  map to guest = Bad User

`

const priviledgedShare = share => `

[${share.name}]
  path = ${share.path}
  browseable = yes
  guest ok = no
  read only = no
  force user = root
  force group = root
  write list = ${share.writelist.join(', ')}
  valid users = ${share.writelist.join(', ')}
  vfs objects = full_audit
  full_audit:prefix = %u|%U|%S|%P
  full_audit:success = create_file mkdir rename rmdir unlink write pwrite
  full_audit:failure = connect
  full_audit:facility = LOCAL7
  full_audit:priority = ALERT
`

const anonymousShare = share => `

[${share.name}]
  path = ${share.path}
  browseable = yes
  guest ok = yes
  read only = no
  force user = root
  force group = root
  vfs objects = full_audit
  full_audit:prefix = %u|%U|%S|%P
  full_audit:success = create_file mkdir rename rmdir unlink write pwrite
  full_audit:failure = connect
  full_audit:facility = LOCAL7
  full_audit:priority = ALERT
`

const usbShare = usb => `

[usb.${usb.name}]
  path = ${usb.mountpoint}
  browseable = yes
  guest ok = yes
  read only = ${usb.readOnly ? 'yes' : 'no'}
  force user = root
  force group = root
`

const genSmbConfAsync = async (shares, usbs) => {
  let text = globalSection
  shares.forEach(share => text += share.anonymous 
    ? anonymousShare(share) 
    : priviledgedShare(share))
  usbs.forEach(usb => text += usbShare(usb))
  await fs.writeFileAsync('/etc/samba/smb.conf', text)
}


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
      // TODO error message: cannot read property 'map' of undefined
      .catch(e => console.log('samba refresh error', e))
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
    let froot = this.ctx.froot

    // clone active users (including users without smb password)
    let users = JSON.parse(JSON.stringify(this.ctx.user.users.filter(u => u.status === 'ACTIVE')))

    // annotate unix username
    users.forEach(u => {
      u.unixName = ['x', ...u.uuid.split('-').map((s, i) => i === 2 ? s.slice(1) : s)].join('')
    }) 

/**
    console.log('>>>>>>')
    console.log(this.ctx.user.users)
    console.log(this.ctx.drive.drives)
    console.log('<<<<<<')
*/

    // clone drives and generate shares
    let shares = this.ctx.drive.drives
      .filter(d => !d.isDeleted)
      .map((drive, idx, arr) => {
        let { uuid } = drive

        if (drive.type === 'public') { // public
          if (drive.tag === 'built-in') { // built-in
            return {
              uuid,
              name: '默认共享盘',
              anonymous: true,
            }
          } else { // other public
            let pubs = arr.filter(d => d.type === 'public' && d.tag !== 'built-in')
            let x = {
              uuid,
              name: drive.label || '共享盘' + (pubs.indexOf(drive) + 1),
            }

            if (Array.isArray(drive.writelist)) {
              x.anonymous = false
              x.writelist = drive.writelist
                .map(uuid => users.find(u => u.uuid === uuid))
                .filter(u => !!u)
                .map(u => u.unixName)
            } else {
              x.anonymous = true
            }
            return x
          }
        } else {  // private
          let user = users.find(u => u.uuid === drive.owner)
          if (!user) return
          if (drive.smb === true) { // priviledged
            if (!user.smbPassword) return // forbidden
            return {
              uuid,
              name: user.phoneNumber,
              anonymous: false,
              writelist: [user.unixName]
            }
          } else {
            return { // anonymous
              uuid,
              name: user.phoneNumber,
              anonymous: true
            }
          }
        }
      })
      .filter(x => !!x)
      .map(x => {
        x.path = `${froot}/drives/${x.uuid}`
        return x
      })

    debug('refreshing users', users)
    await processUsersAsync(users)

    debug('refreshing shares', shares, this.ctx.usbs)
    await genSmbConfAsync(shares, this.ctx.usbs)

    // theoretically, this command force all services to reload config (smbd, nmbd, winbindd etc)
    // await child.execAsync('smbcontrol all reload-config')
    // reload won't reload user change ???

    try {
      await child.execAsync('systemctl restart smbd')
    } catch (e) {
      console.log('failed to restart smbd, retry after 5s')
      await Promise.delay(5000)

      try {
        await child.execAsync('systemctl restart smbd')
      } catch (e) {
        console.log('failed to restart smbd again', e)
        throw e
      }
    }

    debug('smbd restarted')
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
        child.exec('systemctl disable smbd', err => {
          if (err) {
            this.cbs.forEach(cb => cb(err))
            this.setState(Failed, err)
          } else {
            this.cbs.forEach(cb => cb(null))
            this.setState(Stopped)
          }
        })
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
      if (!process.env.NODE_PATH || process.env.LOGE) console.log('smbaudit udp server error', err)
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

