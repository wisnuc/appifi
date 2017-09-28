const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))

const debug = require('debug')('samba')

const rsyslogPath = '/etc/rsyslog.d/99-smbaudit.conf'

let froot, usersTimestamp, drivesTimestamp

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

  await fs.writeFileAsync(rsyslogPath, data)

  try {
    await child.execAsync('systemctl restart rsyslog')  
  } catch (e) {
    console.log('rsyslogd restart error, neglected', e)
  }
}

const pollingFilesAsync = async () => {
  const userFilePath = path.join(froot, 'users.json')
  const driveFilePath = path.join(froot, 'drives.json')

  let ustat = await fs.lstatAsync(userFilePath)
  let dstat = await fs.lstatAsync(driveFilePath)
  let data = await fs.readFileAsync(userFilePath)
  let users = JSON.parse(data)
  data = await fs.readFileAsync(driveFilePath)
  let drives = JSON.parse(data)

  if (ustat.mtime.getTime() === usersTimestamp &&
      dstat.mtime.getTime() === drivesTimestamp) return null 

  usersTimestamp = ustat.mtime.getTime()
  drivesTimestamp = dstat.mtime.getTime()
  return { users, drives }
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

const privateShare = (users, drive) => {
  let owner = users.find(u => u.uuid === drive.owner)
  if (!owner) return ''

  return `
[${owner.name}]
  path = ${froot}/drives/${drive.uuid}
  read only = no
  guest ok = no
  force user = root
  force group = root
  write list = ${owner.unixName}
  valid users = ${owner.unixName}
  vfs objects = full_audit
  full_audit:prefix = %u|%U|%S|%P
  full_audit:success = create_file mkdir rename rmdir unlink write pwrite
  full_audit:failure = connect
  full_audit:facility = LOCAL7
  full_audit:priority = ALERT
`
}

const publicShare = (users, drive) => {
  let name = drive.name || drive.uuid.slice(0, 8) 
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

const genSmbConfAsync = async (users, drives) => {
  let text = globalSection
  let conf = drives.reduce((t, drive) => {
    if (drive.type === 'private') {
      return t + privateShare(users, drive)
    } else {
      return t + publicShare(users, drive)
    }
  }, text)
  await fs.writeFileAsync('/etc/samba/smb.conf', conf)
}

const restartSambaAsync = async () => {
  await child.execAsync('systemctl enable nmbd')
  await child.execAsync('systemctl enable smbd')
  await Promise.delay(1000)
  await child.execAsync('systemctl restart smbd')
  await child.execAsync('systemctl restart nmbd')
}

const refreshAsync = async () => {
  try {
    await rsyslogAsync()
  } catch (e) {
    await Promise.delay(4000)
    throw e
  }

  let x = await pollingFilesAsync()
  if (!x) return
  let users = await processUsersAsync(x.users)
  let drives = await processDrivesAsync(users, x.drives)  
  await genSmbConfAsync(users, drives)
  await restartSambaAsync()
}

const loop = async () => {
  let delay = 4000

  while (true) {
    try {
      await refreshAsync()
      delay = 4000
    } catch (e) {
      console.log('samba error', e)
      if (delay < 4000 * 128)  delay = delay * 2
    }
    await Promise.delay(delay)
  }
}

const nosmb = !!process.argv.find(arg => arg === '--disable-smb')

module.exports = {
  start: function (fruitmixPath) {
    if (!nosmb) {
      froot = fruitmixPath
      loop().then(() => {})
    }
  },

  stop: function () {
    froot = null
  } 
}

