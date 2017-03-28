let fs = require('fs')
let child = require('child_process')
let mkdirp = require('mkdirp')
let getPrependPath = require('./prependPath')

// define some parameters
const userListConfigPath = '../../test/appifi/lib/samba/model.json'
let prependPath = null

// check & restart samba service
let updatingSamba = false
let sambaTimer = -1

const mkdirpAsync = Promise.promisify(mkdirp)
Promise.promisifyAll(fs)
Promise.promisifyAll(child)

// turn uuid to unix name
// xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx <- hyphen and M are removed, then prefixed with letter x
const uuidToUnixName = (uuid) => 
  ['x', ...uuid.split('-').map((s, i) => i === 2 ? s.slice(1) : s)].join('')

// read infors from local file
const getUserListAsync = async () => {
  let userList = {}
  try {
    userList = await fs.readFileAsync(userListConfigPath)
  }
  catch (error) {
    return
	}

  return JSON.parse(userList)
}

// get users & drives list
const createShareListAsync = async () => {

  let list = await getUserListAsync()
  let ulist = list['users']
  let dlist = list['drives']

  let shareList = [] 
  dlist.forEach(drive => {

    if (drive.type === 'private') {

      let owner = ulist.find(user => user.home === drive.uuid || user.library === drive.uuid)
      if (owner) {
        let shareName        
        if (owner.home === drive.uuid) shareName = owner.username + ' (home)'
        else if (owner.library === drive.uuid) shareName = owner.username + ' (library)'
        else shareName = owner.username + ` (${drive.uuid.slice(0, 8)})`

        let sharePath = drive.uuid
        let validUsers = [owner.uuid].map(uuidToUnixName);

        shareList.push({ name: shareName, path: sharePath, validUsers })
      }
    } 
    else if (drive.type === 'public') {

      let shareName = drive.uuid.slice(0, 8)
      let sharePath = '/drives/' + drive.uuid 
      
      let writelist = [...drive.writelist]
        .sort()
        .filter((item, index, array) => !index || item !== array[index - 1])
        .map(uuidToUnixName)

      let validUsers = [...drive.writelist, ...drive.readlist]
        .sort()        
        .filter((item, index, array) => !index || item !== array[index - 1])
        .map(uuidToUnixName)

      if (validUsers.length > 0) {
        shareList.push({ name: shareName, path: sharePath, 
          readOnly: owner.library === drive.uuid ? true : false,
          writelist, validUsers })
      }
    }
    else if (drive.type === 'service') {

    }
  })

  // console.log('share list', shareList)
  return shareList
}

//***********************************************************************/
// first: retrieve users list from both system, and fruitmix
// second: retrieve users/passwords from both samba, and fruitmix
// third: generate new user map
// fourth: generate new samba configuration
// fifth: reload or restart samba

// get system user list
const retrieveSysUsers = (callback) => {
  fs.readFile('/etc/passwd', (err, data) => {
    if (err) return callback(err)
    let users = data.toString().split('\n')
      .map(l => l.trim())
      .filter(l => l.length)
      .map(l => {
        let split = l.split(':')
        if (split.length !== 7) return null
        return {
          unixname: split[0],
          unixuid: parseInt(split[2])
        }
      })
      .filter(u => !!u)
      .filter(u => u.unixuid >= 2000 && u.unixuid < 5000)

    callback(null, users)
  })
}

// get samba user list from local samba service
const retrieveSmbUsers = (callback) => {
  child.exec('pdbedit -Lw', (err, stdout) => {
    if (err) return callback(err)
    let users = stdout.toString().split('\n')
      .map(l => l.trim())
      .filter(l => l.length)
      .map(l => {
        let split = l.split(':')
        if (split.length !== 7) return null
        return {
          unixname: split[0],
          unixuid: parseInt(split[1]),
          md4: split[3],
          lct: split[5]
        } 
      })
      .filter(u => !!u)

    // console.log('retrieveSmbUsers', stdout.toString().split('\n'))
    callback(null, users)
  })
}

// add user to system
const addUnixUserAsync = async (username, unixuid) => {
  // console.log('addUnixUser', username, unixuid)
  let cmd = 'adduser --disabled-password --disabled-login --no-create-home --gecos ",,," ' + 
    `--uid ${unixuid} --gid 65534 ${username}`
  return child.execAsync(cmd)
}

// delete user from system
const deleteUnixUserAsync = async (username) => {
  // console.log('deleteUnixUser', username)
  return child.execAsync(`deluser ${username}`)
}

// reconcile user list from system & fruitmix
const reconcileUnixUsersAsync = async () => {
  let sysusers = await Promise.promisify(retrieveSysUsers)()
  // console.log('reconcile unix users, unix users', sysusers)

  let userList = await getUserListAsync();
  let fusers = userList['users'].map(u => ({ unixname: uuidToUnixName(u.uuid), unixuid:u.unixuid }))
  // console.log('reconcile unix users, fruitmix users', fusers)

  let common = new Set()
  fusers.forEach(fuser => {
    let found = sysusers.find(sysuser => 
      sysuser.unixname === fuser.unixname && sysuser.unixuid === fuser.unixuid)
    if (found) common.add(found.unixname + ':' + found.unixuid)
  })

  // console.log('reconcile unix users, common', common)

  fusers = fusers.filter(f => !common.has(f.unixname + ':' + f.unixuid))
  // console.log('reconcile unix users, fruitmix users (subtracted)', fusers)

  sysusers = sysusers.filter(s => !common.has(s.unixname + ':' + s.unixuid))
  // console.log('reconcile unix users, unix users (subtracted)', sysusers)

  await Promise.map(sysusers, u => deleteUnixUserAsync(u.unixname).reflect())
  await Promise.map(fusers, u => addUnixUserAsync(u.unixname, u.unixuid).reflect())
}

// delete samba user from local samba service
const deleteSmbUserAsync = async (username) => {
  // console.log('delete smb user', username)
  return child.execAsync(`pdbedit -x ${username}`)
}

// add samba user to local samba service
const addSmbUsersAsync = async (fusers) => {
  let text = fusers.map(u => `${u.unixname}:${u.unixuid}:` + 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:' +
    `${u.md4}:[U          ]:${u.lct}:`).join('\n')

  // console.log('addSmbUsers', text)

  await mkdirpAsync('/run/wisnuc/smb')
  await fs.writeFileAsync('/run/wisnuc/smb/tmp', text)
  await child.execAsync('pdbedit -i smbpasswd:/run/wisnuc/smb/tmp')

  // console.log('addSmbUsers, after', await child.execAsync('pdbedit -Lw'))
}

// reconcile user list from local samba service & fruitmix
const reconcileSmbUsersAsync = async () => {
  const key = user => 
    [user.unixname, user.unixuid.toString(), user.md4, user.lct].join(':')

  let smbusers = await Promise.promisify(retrieveSmbUsers)()
  // console.log('reconcile smb users, smbusers', smbusers)

  let userList = await getUserListAsync();
  let fusers = userList['users'].map(u => ({
    unixname: uuidToUnixName(u.uuid),
    unixuid: u.unixuid,
    md4: u.smbPassword.toUpperCase(),
    lct: 'LCT-' + Math.floor(u.lastChangeTime / 1000).toString(16).toUpperCase() // TODO
  }))
  // console.log('reconcile smb users, fruitmix users', fusers)

  let common = new Set()
  fusers.forEach(f => {
    let found = smbusers.find(s =>
      s.unixname === f.unixname && s.unixuid === f.unixuid && s.md4 === f.md4 && s.lct === f.lct)
    if (found)
      common.add(key(found))
  })
  // console.log('reconcile smb users, common', common)

  smbusers = smbusers.filter(s => !common.has(key(s)))
  // console.log('reconcile smb users, smb users (subtracted)', smbusers)

  fusers = fusers.filter(f => !common.has(key(f)))
  // console.log('reconcile smb users, fruitmix users (subtracted)', fusers)

  // remove
  await Promise.map(smbusers, (smbuser) => 
    deleteSmbUserAsync(smbuser.unixname).reflect())

  // add 
  await addSmbUsersAsync(fusers)
}

// mapping usernames from the clients to the local samba server
const generateUserMapAsync = async () => {
  let userList = await getUserListAsync();
  let text = userList['users'].reduce((prev, user) =>
    prev + `${uuidToUnixName(user.uuid)} = "${user.username}"\n`, '')

  // console.log('generate usermap', text)
  await fs.writeFileAsync('/etc/smbusermap', text)
}

// create samba's smb.conf
const generateSmbConfAsync = async () => {

	prependPath = getPrependPath()

	if(prependPath === null) {
		return null
	}

  let global =  '[global]\n' +
                '  username map = /etc/smbusermap\n' +
                '  workgroup = WORKGROUP\n' +
                '  netbios name = SAMBA\n' +
                '  map to guest = Bad User\n' +
                '  log file = /var/log/samba/%m\n' +
                '  log level = 1\n\n'

  const section = (share) => {
    let tmpStr = '';
    tmpStr = `[${share.name}]\n`;
    tmpStr = tmpStr.concat(`  path = ${prependPath}/${share.path}\n` +
                           `  read only = ${share.readOnly ? "yes" : "no"}\n` +
                           '  guest ok = no\n' +
                           '  force user = root\n' +
                           '  force group = root\n');

    if(!share.readOnly) {
      tmpStr = tmpStr.concat(`  write list = ${(share.validUsers).length > 1?share.writelist.join(', '):share.validUsers}\n` + // writelist
                             `  valid users = ${(share.validUsers).length > 1?share.validUsers.join(', '):share.validUsers}\n` +
                             '  vfs objects = full_audit\n' +
                             '  full_audit:prefix = %u|%U|%S|%P\n' +
                             '  full_audit:success = create_file mkdir rename rmdir unlink write pwrite \n' + // dont remove write !!!!
                             '  full_audit:failure = connect\n' +
                             '  full_audit:facility = LOCAL7\n' +
                             '  full_audit:priority = ALERT\n');
    }

    return tmpStr;
  }

  let conf = global

  let getShareList = await createShareListAsync();
  getShareList.forEach(share => {
    conf += section(share) + '\n';
  })

  // console.log('generateSmbConf', conf)
  await fs.writeFileAsync('/etc/samba/smb.conf', conf)
}

// delay restart samba time for default 1 second
const scheduleUpdate = () => {
  if (sambaTimer !== -1) {
    clearTimeout(sambaTimer)
    sambaTimer = -1
  }

  sambaTimer = setTimeout(() => {
    if (updatingSamba) {
      scheduleUpdate()
      return
    }
    updateSambaFiles().then(() => {}).catch(e => {})

  }, 1000)
}

const updateSambaFilesAsync = async () => {
  updatingSamba = true
  try {
    // console.log('updating samba files')
    await reconcileUnixUsersAsync()
    await reconcileSmbUsersAsync()
    await generateUserMapAsync()

    let result = await generateSmbConfAsync()
		if(result === null) {
			throw new Error('prependPath error')
		}

    await child.execAsync('systemctl restart smbd')
  }
  catch (e) {
    console.log(e)
  }

  updatingSamba = false
}

module.exports = updateSambaFilesAsync