const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const events = require('events')
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))

const debug = require('debug')('samba')

const rsyslogPath = '/etc/rsyslog.d/99-smbaudit.conf'


class SambaServer extends events.EventEmitter {
  constructor() {
    super()
    this.froot = undefined
  }

  async retrieveSysUsersAsync() {
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
  
  async retrieveSmbUsersAsync() {
    let stdout = await child.exec('pdbedit -Lw')
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

  async rsyslogAsync() {
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

  // this function 
  // 1. sync /etc/passwd, 
  // 2. sync smb passwd db, 
  // 3. generate user map
  // returns users
  async processUsersAsync(users) {
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

  async processDrivesAsync(users, drives) {
    // TODO check names
    return drives
  }

  start(fpath, callpack) {
    this.froot = fpath
  }

  async startAsync(fpath) {

  }

  stop(callpack) {

  }

  async stopAsync() {

  }

  restart(callpack) {

  }

  async restartAsync() {

  }

  update(users, drives) {

  }

  destory() {

  }
}

