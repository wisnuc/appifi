const Promise = require('bluebird')
const path = require('path')
const events = require('events')
const dgram = require('dgram')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))

const debug = require('debug')('samba')

const rsyslogPath = '/etc/rsyslog.d/99-smbaudit.conf'

const nosmb = !!process.argv.find(arg => arg === '--disable-smb') || process.env.NODE_PATH !== undefined

// this function update rsyslog conf
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
    .filter(u => /^x[0-9a-f]{31}$/.test(u.name))
}

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
const processUsersAsync = async users => {
  // remove disabled users
  users = users.filter(u => !u.disabled)

  // generate unix name 
  users.forEach(u => 
    u.unixName = ['x', ...u.uuid.split('-').map((s, i) => i === 2 ? s.slice(1) : s)].join(''))
  
  // retrieve
  let sysUsers = await retrieveSysUsersAsync()

  // remove old users
  let outdated = sysUsers.filter(su => !users.find(fu => fu.unixName === su.name))
  for (let i = 0; i < outdated.length; i++) {
    try {
      await child.execAsync(`deluser ${outdated[i].name}`)
    } catch (e) {
      console.log(`error deleting user ${outdated[i].name}`)
    }
  } 

  // add new users to system
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

  // retrieve system users again and filter out fusers without corresponding sys user (say, failed to create)
  sysUsers = await retrieveSysUsersAsync()
  users = users.reduce((acc, fu) => {
    let su = sysUsers.find(su => su.name === fu.unixName) 
    if (su) {
      fu.unixUID = su.id
      acc.push(fu)
    }
    return acc
  }, [])

  // retrieve smb users
  smbUsers = await retrieveSmbUsersAsync()
  // clean smb users
  for (let i = 0; i < smbUsers.length; i++) {
    try {
      await child.execAsync(`pdbedit -x ${smbUsers[i].name}`)
    } catch (e) {
      console.log(`error deleting smb user ${smbUsers[i].name}`)
    }
  }
  // create all smbusers
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

  debug('samba passwd db', text)

  await mkdirpAsync('/run/wisnuc/smb')
  await fs.writeFileAsync('/run/wisnuc/smb/tmp', text)
  await child.execAsync('pdbedit -i smbpasswd:/run/wisnuc/smb/tmp')
  await rimrafAsync('/run/wisnuc/smb')

  // creat user map
  text = users
    .map(u => `${u.unixName} = "${u.username}"`)
    .join('\n')
    
  await fs.writeFileAsync('/etc/smbusermap', text)
  return users
}

const processDrivesAsync = async (users, drives) => {
  // TODO check names
  return drives
}

const globalSection = `
[global]
  username map = /etc/smbusermap
  workgroup = WORKGROUP
  netbios name = SAMBA
  map to guest = Bad User
  log file = /var/log/samba/%m
  log level = 1
`

const privateShare = (froot, users, drive) => {
  let owner = users.find(u => u.uuid === drive.owner)
  if (!owner) return ''

  return `
[${owner.username}]
  path = ${froot}/drives/${drive.uuid}
  read only = no
  guest ok = no
  force user = root
  force group = root
  write list = ${owner.unixName}
  valid users = ${owner.unixName}
  vfs objects = full_audit
  full_audit:prefix = %u|%U|%S|%P
  full_audit:success = create_file mkdir rename rmdir unlink write pwrite close
  full_audit:failure = connect
  full_audit:facility = LOCAL7
  full_audit:priority = ALERT
`
}

const publicShare = (froot, users, drive) => {
  let name = drive.label || drive.uuid.slice(0, 8) 
  let writelist = drive.writelist
    .map(uuid => users.find(u => u.uuid === uuid))
    .filter(u => !!u)
    .map(u => u.unixName)

  let readlist = [...drive.writelist, ...drive.readlist]
    .map(uuid => users.find(u => u.uuid === uuid))
    .filter(u => !!u)
    .map(u => u.unixName)

  return `
[${name}]
  path = ${froot}/drives/${drive.uuid}
  read only = no
  guest ok = no
  force user = root
  force group = root
  write list = ${writelist.join(', ')}
  valid users = ${readlist.join(', ')}
  vfs objects = full_audit
  full_audit:prefix = %u|%U|%S|%P
  full_audit:success = create_file mkdir rename rmdir unlink write pwrite
  full_audit:failure = connect
  full_audit:facility = LOCAL7
  full_audit:priority = ALERT
`
}

const genSmbConfAsync = async (froot, users, drives) => {
  let text = globalSection
  let conf = drives.reduce((t, drive) => {
    if (drive.type === 'private') {
      return t + privateShare(froot, users, drive)
    } else {
      return t + publicShare(froot, users, drive)
    }
  }, text)
  await fs.writeFileAsync('/etc/samba/smb.conf', conf)
}

class SambaServer extends events.EventEmitter {
  constructor(fpath) {
    super()
    this.froot = fpath
    this.udpServer = undefined
    this.startUdpServer(() => {}) //  FIXME: error?
    this.isStop = true
  }

  startUdpServer(callback) {
    let udp = dgram.createSocket('udp4')
    this.udpServer = udp
    udp.on('listening', () => {
      const a = udp.address()
      console.log(`fruitmix udp listening ${a.address}:${a.port}`)
    })

    udp.on('message', (message, rinfo) => {
      const token = ' smbd_audit: '

      let text = message.toString()
      // SAMBA_AUDIT(text)
      //
      // enter into folder 'aaa', then create a new file named 'bbb', then edit it.
      //
      // samba audit like below:
      // <185>Jun 16 11:01:14 wisnuc-virtual-machine smbd_audit: root|a|a (home)|/run/wisnuc/volumes/56b.../wisnuc/fruitmix/drives/21b...|create_file|ok|0x100080|file|open|aaa/bbb.txt
      //
      // arr[0]: root
      // arr[1]: a
      // arr[2]: a (home)
      // arr[3]: /run/wisnuc/volumes/56b.../wisnuc/fruitmix/drives/21b...
      // arr[4]: create_file
      // arr[5]: ok
      // arr[6]: 0x100080
      // arr[7]: file
      // arr[8]: open
      // arr[9]: aaa/bbb.txt
      //
      // user: a
      // share: a (home)
      // abspath: /run/wisnuc/volumes/56b.../wisnuc/fruitmix/drives/21b...
      // op: create_file

      let tidx = text.indexOf(' smbd_audit: ')
      if (tidx === -1) return

      let arr = text.trim().slice(tidx + token.length).split('|')

      // for(var i = 0; i < arr.length; i++){
      //   SAMBA_AUDIT(`arr[${i}]: ` + arr[i])
      // }

      // %u <- user
      // %U <- represented user
      // %S <- share
      // %P <- path

      if (arr.length < 6 || arr[0] !== 'root' || arr[5] !== 'ok') return

      let user = arr[1]
      let share = arr[2]
      let abspath = arr[3]
      let op = arr[4]
      let arg0, arg1

      // create_file arg0
      // mkdir arg0
      // rename arg0 arg1 (file or directory)
      // rmdir arg0 (delete directory)
      // unlink arg0 (delete file)
      // write (not used anymore)
      // pwrite

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

    udp.bind('3721', '127.0.0.1', callback)
  }

  async startAsync(users, drives) {
    this.isStop = false
    await rsyslogAsync()
    let x = this.transfer(users, drives)
    let userArr = await processUsersAsync(x.users)
    let driveArr = await processDrivesAsync(x.users, x.drives) 
    await genSmbConfAsync(this.froot, userArr, driveArr)
    await this.restartAsync()
    debug('smbd start!!!') 
  }

  transfer(users, drives) {
    let userArr = users.map(u => Object.assign({}, u))
    let uids = userArr.map(u => u.uuid)
    let driveArr = drives.map(d => Object.assign({}, d))
    driveArr.forEach(d => {
      if(d.writelist === '*') d.writelist = uids
      if(d.readlist === '*') d.readlist = uids
    })
    return { users: userArr, drives: driveArr }
  }

  async stopAsync() {
    this.isStop = true
    await child.execAsync('systemctl stop smbd')
    await child.execAsync('systemctl stop nmbd')
  }

  async restartAsync() {
    await rsyslogAsync() // ?
    await child.execAsync('systemctl enable nmbd')
    await child.execAsync('systemctl enable smbd')
    await Promise.delay(1000)
    await child.execAsync('systemctl restart smbd')
    await child.execAsync('systemctl restart nmbd')
  }

  async updateAsync(users, drives) {
    if(this.isStop) return
    let x = this.transfer(users, drives)
    let userArr = await processUsersAsync(x.users)
    let driveArr = await processDrivesAsync(x.users, x.drives)  
    await genSmbConfAsync(this.froot, userArr, driveArr)
    await this.restartAsync()
  }

  isActive() {
    try {
      let status = child.spawnSync('systemctl', ['is-active', 'smbd']).stdout.toString()
      status = status.split('\n').join('')
      return status === 'active' ? true : false
    } 
    catch(e) {
      debug(e)
      return false
    }
  }

  destory() {
    if(this.udpServer) {
      this.udpServer.removeAllListeners()
      this.udpServer.on('error', () => {})
      this.udpServer.close()
      this.udpServer = undefined
    }
    this.stopAsync().then(() => {})
    this.froot = undefined
  }

}

module.exports = SambaServer
