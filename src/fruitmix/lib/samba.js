import path from 'path'
import fs from 'fs'
import child from 'child_process'
import EventEmitter from 'events'
import dgram from 'dgram'

import Debug from 'debug'
const debug = Debug('fruitmix:samba')

import mkdirp from 'mkdirp'

import paths from './paths'
import models from '../models/models'

import { storeState } from '../../appifi/lib/reducers'

const mkdirpAsync = Promise.promisify(mkdirp)
Promise.promisifyAll(fs)
Promise.promisifyAll(child)

const userList = () => 
  models.getModel('user').collection.list.filter(user => user.type === 'local')

// xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx <- hyphen and M are removed, then prefixed with letter x
const uuidToUnixName = (uuid) => 
  ['x', ...uuid.split('-').map((s, i) => i === 2 ? s.slice(1) : s)].join('')

/**
  share
  
  { 
    name: string,
    readOnly: boolean, (for library)
    path: absolute path in system for samba
    writelist:  only if readOnly === false
    validUsers:
  }
**/
const shareList = (userList) => {

  let umod = models.getModel('user')
  let dmod = models.getModel('drive')
  let ulist = umod.collection.list
  let dlist = dmod.collection.list

  let shares = [] 
  dlist.forEach(drive => {

    if (drive.URI !== 'fruitmix') return
  
    if (drive.fixedOwner === true) {

      let owner = ulist.find(user => user.home === drive.uuid || user.library === drive.uuid)
      if (owner) {
        let shareName = drive.label // drive.uuid.slice(0, 8)
        let sharePath = drive.uuid
        let writelist = [owner.uuid, ...drive.writelist]
          .sort()
          .filter((item, index, array) => !index || item !== array[index - 1])
          .map(uuidToUnixName)

        let validUsers = [owner.uuid, ...drive.writelist, ...drive.readlist]
          .sort()        
          .filter((item, index, array) => !index || item !== array[index - 1])
          .map(uuidToUnixName)

        shares.push({ name: shareName, path: sharePath, 
          readOnly: owner.library === drive.uuid ? true : false,
          writelist, validUsers })
      }
    } 
    else if (drive.fixedOwner === false) {

      let shareName = drive.uuid.slice(0, 8)
      let sharePath = '/drives/' + drive.uuid 
      
      let writelist = [...drive.owner, ...drive.writelist].sort()
        .filter((item, index, array) => !index || item !== array[index - 1])
        .map(uuidToUnixName)

      let validUsers = [...drive.owner, ...drive.writelist, ...drive.readlist].sort()        
        .filter((item, index, array) => !index || item !== array[index - 1])
        .map(uuidToUnixName)

      if (validUsers.length > 0) {
        shares.push({ name: shareName, path: sharePath, writelist, validUsers })
      }
    }
  })

  return shares
}


// first: retrieve users list from both system, and fruitmix
// second: retrieve users/passwords from both samba, and fruitmix
// third: generate new user map
// fourth: generate new samba configuration
// fifth: reload or restart samba

const retrieveSysUsers = (callback) => 
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
          uid: parseInt(split[2])
        }
      })
      .filter(u => !!u)
      .filter(u => u.uid >= 2000 && u.uid < 5000)

    callback(null, users)
  })


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
          uid: parseInt(split[1]),
          md4: split[3],
          lct: split[5]
        } 
      })
      .filter(u => !!u)

    debug('retrieveSmbUsers', stdout.toString().split('\n'))
    callback(null, users)
  })
}

const addUnixUserAsync = async (username, uid) => {

  debug('addUnixUser', username, uid)
  let cmd = 'adduser --disabled-password --disabled-login --no-create-home --gecos ",,," ' + 
    `--uid ${uid} --gid 65534 ${username}`
  return child.execAsync(cmd)
}

const deleteUnixUserAsync = async (username) => {

  debug('deleteUnixUser', username)
  return child.execAsync(`deluser ${username}`)
}

const reconcileUnixUsersAsync = async () => {

  let sysusers = await Promise.promisify(retrieveSysUsers)()
  debug('reconcile unix users, unix users', sysusers)

  let fusers = userList().map(u => ({ unixname: uuidToUnixName(u.uuid), uid:u.unixUID }))
  debug('reconcile unix users, fruitmix users', fusers)

  let common = new Set()
  fusers.forEach(fuser => {
    let found = sysusers.find(sysuser => 
      sysuser.unixname === fuser.unixname && sysuser.uid === fuser.uid)
    if (found) common.add(found.unixname + ':' + found.uid)
  })

  debug('reconcile unix users, common', common)

  fusers = fusers.filter(f => !common.has(f.unixname + ':' + f.uid))
  debug('reconcile unix users, fruitmix users (subtracted)', fusers)

  sysusers = sysusers.filter(s => !common.has(s.unixname + ':' + s.uid))
  debug('reconcile unix users, unix users (subtracted)', sysusers)

  await Promise.map(sysusers, u => deleteUnixUserAsync(u.unixname).reflect())
  await Promise.map(fusers, u => addUnixUserAsync(u.unixname, u.uid).reflect())
}

const deleteSmbUserAsync = async (username) => {
  debug('delete smb user', username)
  return child.execAsync(`pdbedit -x ${username}`)
}

const addSmbUsersAsync = async (fusers) => {

  let text = fusers.map(u => `${u.unixname}:${u.uid}:` + 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:' +
    `${u.md4}:[U          ]:${u.lct}:`).join('\n')

  debug('addSmbUsers', text)

  await mkdirpAsync('/run/wisnuc/smb')
  await fs.writeFileAsync('/run/wisnuc/smb/tmp', text)
  await child.execAsync('pdbedit -i smbpasswd:/run/wisnuc/smb/tmp')

  debug('addSmbUsers, after', await child.execAsync('pdbedit -Lw'))
}

const reconcileSmbUsersAsync = async () => {

  const key = user => 
    [user.unixname, user.uid.toString(), user.md4, user.lct].join(':')

  let smbusers = await Promise.promisify(retrieveSmbUsers)()
  debug('reconcile smb users, smbusers', smbusers)

  let fusers = userList().map(u => ({ 
    unixname: uuidToUnixName(u.uuid),
    uid: u.unixUID,
    md4: u.smbPassword.toUpperCase(),
    lct: 'LCT-' + Math.floor(u.lastChangeTime / 1000).toString(16).toUpperCase() // TODO
  }))
  debug('reconcile smb users, fruitmix users', fusers)

  let common = new Set()
  fusers.forEach(f => {
    let found = smbusers.find(s =>
      s.unixname === f.unixname && s.uid === f.uid && s.md4 === f.md4 && s.lct === f.lct)
    if (found)
      common.add(key(found))
  })
  debug('reconcile smb users, common', common)

  smbusers = smbusers.filter(s => !common.has(key(s)))
  debug('reconcile smb users, smb users (subtracted)', smbusers)

  fusers = fusers.filter(f => !common.has(key(f)))
  debug('reconcile smb users, fruitmix users (subtracted)', fusers)

  // remove
  await Promise.map(smbusers, (smbuser) => 
    deleteSmbUserAsync(smbuser.unixname).reflect())

  // add 
  await addSmbUsersAsync(fusers)
}

const generateUserMapAsync = async () => {

  let text = userList().reduce((prev, user) => 
    prev + `${uuidToUnixName(user.uuid)} = "${user.username}"\n`, '')

  debug('generate usermap', text)
  await fs.writeFileAsync('/etc/smbusermap', text)
}

const generateSmbConfAsync = async () => {

  let cfs = storeState().sysboot.currentFileSystem
  let prepend = path.join(cfs.mountpoint, 'wisnuc', 'fruitmix', 'drives')

  let global =  '[global]\n' +
                '  username map = /etc/smbusermap\n' +
                '  workgroup = WORKGROUP\n' +
                '  netbios name = SAMBA\n' +
                '  map to guest = Bad User\n' +
                '  log file = /var/log/samba/%m\n' +
                '  log level = 1\n\n'

  const section = (share) => 
    `[${share.name}]\n` +                                 // username or sharename
    `  path = ${prepend}/${share.path}\n` +                // uuid path
    `  read only = ${share.readOnly ? "yes" : "no"}\n` +
    '  guest ok = no\n' +
    '  force user = root\n' + 
    '  force group = root\n' +
    `  valid users = ${share.validUsers.join(', ')}\n` +  
    (share.readOnly ? '' :
    `  write list = ${share.writelist.join(', ')}\n` +    // writelist
    '  vfs objects = full_audit\n' +
    '  full_audit:prefix = %u|%U|%S|%P\n' +
    '  full_audit:success = create_file mkdir rename rmdir unlink write pwrite \n' + // dont remove write !!!!
    '  full_audit:failure = connect\n' +
    '  full_audit:facility = LOCAL7\n' +
    '  full_audit:priority = ALERT\n\n')  

  let conf = global
  shareList().forEach(share => conf += section(share))
  debug('generateSmbConf', conf)
  await fs.writeFileAsync('/etc/samba/smb.conf', conf)
}

class SmbAudit extends EventEmitter {

  constructor(udp) {
    super()

    this.udp = udp
    this.udp.on('message', (message, remote) => {
     
      const token = ' smbd_audit: ' 

      let text = message.toString()
      let tidx = text.indexOf(' smbd_audit: ')
      if (tidx === -1) return

      let arr = text.trim().slice(tidx + token.length).split('|')

      // %u <- user
      // %U <- represented user
      // %S <- share
      // %P <- path 

      if (arr.length < 6 || arr[0] !== 'root' || arr[5] !== 'ok')
        return    
 
      let user = arr[1]
      let share = arr[2]
      let abspath = arr[3]
      let op = arr[4]
      let arg0, arg1

      // create_file arg0
      // mkdir
      // rename
      // rmdir
      // unlink (delete file)
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

      default:
        return
      }

      let audit = { user, share, abspath, op, arg0 }
      if (arg1) audit.arg1 = arg1
      
      // debug(arr, audit)
      
      let filer = models.getModel('filer')
      filer.requestProbeByAudit(audit)
    })

    this.udp.on('close', () => console.log('smbaudit upd server closed'))
  }
}

const updateSambaFiles = async () => {

  try {
  debug('updating samba files')

  await reconcileUnixUsersAsync()
  await reconcileSmbUsersAsync()
  await generateUserMapAsync() 
  await generateSmbConfAsync()

  debug('reloading smbd configuration')
  await child.execAsync('systemctl reload smbd')
  }
  catch (e) {
    console.log(e)
  }
}

const initSamba = async () => {

  const logConfigPath = '/etc/rsyslog.d/99-smbaudit.conf'
  const logConfig = 'LOCAL7.*    @127.0.0.1:3721'

  // update rsyslog config if necessary
  let config = null
  try { config = await fs.readFileAsync(logConfigPath) } catch (e) {}
  if (config !== logConfig) {
    await fs.writeFileAsync(logConfigPath, logConfig)  
    await child.execAsync('systemctl restart rsyslog')
  }

  await child.execAsync('systemctl start nmbd')
  await child.execAsync('systemctl start smbd')
}

const createUdpServer = (callback) => {

  let udp = dgram.createSocket('udp4')
  udp.on('listening', () => {
    callback(null, new SmbAudit(udp))
  }) 
 
  udp.once('error', err => {
    if (err.code === 'EADDRINUSE') callback(err)
  }) 
  udp.bind(3721)
}

const createSmbAuditAsync = async () => {

  // TODO not optimal
  await initSamba()
  await updateSambaFiles()
  let udp = await Promise.promisify(createUdpServer)()
  return new SmbAudit(udp)
}

export const createSmbAudit = (callback) => createSmbAuditAsync().asCallback(callback)

