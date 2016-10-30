import path from 'path'
import fs from 'fs'
import child from 'child_process'
import EventEmitter from 'events'
import dgram from 'dgram'

import Debug from 'debug'
const debug = Debug('fruitmix:samba')

import paths from './paths'
import models from '../models/models'

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
        let shareName = drive.uuid.slice(0, 8)
        let sharePath = '/drives/' + drive.uuid
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
          uid: split[2]
        }
      })
      .filter(u => !!u)

    callback(null, users)
  })
}

const retrieveSmbUsers = (callback) => {

  child.exec('pdbedit -Lw', (err, stdout) => {
    if (err) return callback(err)
    let users = data.toString().split('\n')
      .map(l => l.trim())
      .filter(l => l.length)
      .map(l => {
        let split = l.split(':')
        if (split.length !== 6) return null
        return {
          unixname: split[0],
          uid: parseInt(split[1]),
          md4: split[3],
          lct: split[5]
        } 
      })
      .filter(u => !!u)

    callback(null, users)
  })
}

const addUnixUser = (username, uid, callback) => 
  child.exec('adduser --disabled-password --disabled-login --no-create-home ' +
    `--gecos ",,," --uid ${uid} --gid 65534 ${username}\n`, err => callback(err))

const deleteUnixUser = (username, callback) => 
  child.exec(`deluser ${username}`, err => callback(err)) 


const reconcileUnixUserAsync = async () => {

  let sysusers = await Promise.promisify(retrieveSysUsers)
  let fusers = userList().map(u => ({ unixname: uuidToUnixName(u.uuid), uid:u.unixUID }))

  // common
  let common = [] 
  fusers.forEach(fuser => {
    let found = sysusers.find(sysuser => 
      sysuser.unixname === fuser.unixname && sysuser.uid === fuser.uid)
    if (found) common.push({fuser}) 
  })

  // subtract
  fusers = fusers.filter(f => common.find(c => c.unixname === f.unixname && c.uid === f.uid))
  sysusers = sysusers.filter(s => common.find(c => c.unixname === s.unixname && c.uid === s.uid))

  // delete, with bluebird reflect
  await Promise.map(sysusers, (sysuser) => deleteUnixUser(sysuser.unixname).reflect())

  // add
  await Promise.map(fusers, (fuser) => addUnixUser(fuser.unixname).reflect())
}

const deleteSmbUser = (username, callback) => 
  child.exec(`pdbedit -x ${username}`, err => callback(err))

const smbTmpUserPath = '/run/wisnuc/smb/tmp'

const addSmbUsers = (fusers, callback) => {

  let text = fusers.map(u => `${u.unixname}:${u.uid}:` + 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:' +
    `${u.md4}:[U          ]:${u.lct}:`).join('\n')

  fs.writeFile(smbTmpUserPath, text, err => err ? callback(err) :
    child.exec('pdbedit -i smbpasswd:' + smbTmpUserPath, err => callback(err)))
}

const reconcileSmbUserAsync = async () => {

  let smbusers = await Promise.promisify(retrieveSmbUsers)
  let fusers = userList().map(u => ({ 
    unixname: uuidToUnixName(u.uuid),
    uid: u.unixUID,
    md4: u.smbPassword.toUpperCase(),
    lct: 'LCT-' + Math.floor(u.lastChangeTime / 1000).toString('hex').toUpperCase()
  }))

  let common = fusers.reduce((r, f) => 
    smbusers.find(s => s.unixname === curr.unixname &&
      s.uid === f.uid && s.md4 === f.md4 ? [...r, {f, s}] : r, []))

  fusers = fusers.filter(f => common.find(c => c.f !== f))
  smbusers = smbusers.filter(s => common.find(c => c.s !== s))

  // remove
  await Promise.map(smbusers, (smbuser) => deleteSmbUser(smbuser.unixname).reflect())

  // add 
  await Promise.promisify(addSmbUsers)(fusers)
}

const generateUserMap = () => 
  userList().reduce((prev, user) => prev + `${uuidToUnixName(user.uuid)} = "${user.username}"\n`, '')

const generateSmbConf = () => {

  let global =  '[global]\n' +
                '  username map = /usernamemap.txt\n' +
                '  workgroup = WORKGROUP\n' +
                '  netbios name = SAMBA\n' +
                '  map to guest = Bad User\n' +
                '  log file = /var/log/samba/%m\n' +
                '  log level = 1\n\n'

  const section = (share) => 
    `[${share.name}]\n` +                               // username or sharename
    `  path = ${share.path}\n` +                        // uuid path
    '  read only = no\n' +
    '  guest ok = no\n' +
    '  force user = root\n' + 
    '  force group = root\n' +
    `  valid users = ${share.validUsers.join(', ')}\n` +  // valid users
    `  write list = ${share.writelist.join(', ')}\n` +    // writelist
    '  vfs objects = full_audit\n' +
    '  full_audit:prefix = %u|%U|%S|%P\n' +
    '  full_audit:success = create_file mkdir rename rmdir unlink write pwrite \n' + // dont remove write !!!!
    '  full_audit:failure = connect\n' +
    '  full_audit:facility = LOCAL7\n' +
    '  full_audit:priority = ALERT\n\n'   

  let conf = global
  shareList().forEach(share => conf += section(share))

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
      
      debug(arr, audit)
    })

    this.udp.on('close', () => console.log('smbaudit upd server closed'))
  }
}

const updateSambaFiles = async () => {

  debug('updating samba files')
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

  await updateSambaFiles()
  await initSamba()
  let udp = await Promise.promisify(createUdpServer)()
  return new SmbAudit(udp)
}

export const createSmbAudit = (callback) => createSmbAuditAsync().asCallback(callback)

