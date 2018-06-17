const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))
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

// 处理users, drives 结构
const transfer = (users, drives) => {
  let userArr = users.map(u => Object.assign({}, u))
  let uids = userArr.map(u => u.uuid)
  let driveArr = drives.map(d => Object.assign({}, d))
  driveArr.forEach(d => {
    if(d.writelist === '*') d.writelist = uids
    if(d.readlist === '*') d.readlist = uids
  })
  return { users: userArr, drives: driveArr }
}

// this function 
// 1. sync /etc/passwd, 
// 2. sync smb passwd db, 
// 3. generate user map
// returns users
const processUsersAsync = async users => {
  // 将disable用户从数组中移除
  users = users.filter(u => u.status === 'ACTIVE' && !!u.smbPassword)

  // 生成系统用户名
  users.forEach(u => 
    u.unixName = ['x', ...u.uuid.split('-').map((s, i) => i === 2 ? s.slice(1) : s)].join(''))
  
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
  smbUsers = await retrieveSmbUsersAsync()
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
    .map(u => `${u.unixName} = "${u.username}"`)
    .join('\n')
    
  await fs.writeFileAsync('/etc/smbusermap', text)
  return users
}

// 读取系统用户信息
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
    .filter(u => /^x[0-9a-f]{31}$/.test(u.name)) //31位长度的用户名是NAS用户对应UUID
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

const processDrivesAsync = async (users, drives) => {
  // TODO check names
  return drives.filter(drive => drive.smb)
  
}

// samba 配置文件 头部信息
const globalSection = `
[global]
  username map = /etc/smbusermap
  workgroup = WORKGROUP
  netbios name = SAMBA
  map to guest = Bad User
  log file = /var/log/samba/%m
  log level = 1
`

// samba 配置文件 私有云盘配置
const privateShare = (froot, users, drive) => {
  let owner = users.find(u => u.uuid === drive.owner)
  if (!owner) return ''

  return `
[${owner.username}]
  path = ${froot}/drives/${drive.uuid}
  browseable = yes
  public = yes
  guest ok = yes
  read only = no
  force user = root
  force group = root
  ${drive.smb?`write list = ${owner.unixName}`:''}
  ${drive.smb?`valid users = ${owner.unixName}`:''}
  vfs objects = full_audit
  full_audit:prefix = %u|%U|%S|%P
  full_audit:success = create_file mkdir rename rmdir unlink write pwrite close
  full_audit:failure = connect
  full_audit:facility = LOCAL7
  full_audit:priority = ALERT
`
}

// samba 配置文件 公共盘配置
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
  browseable = yes
  public = yes
  guest ok = yes
  read only = no
  force user = root
  force group = root
  ${drive.tag === 'built-in'? '': `write list = ${writelist.join(', ')}`}
  ${drive.tag === 'built-in'? '': `valid users = ${readlist.join(', ')}`}
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

module.exports = {
  rsyslogAsync,
  transfer,
  processUsersAsync,
  processDrivesAsync,
  genSmbConfAsync
}