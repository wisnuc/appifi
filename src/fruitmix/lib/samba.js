import path from 'path'
import fs from 'fs'
import child from 'child_process'
import EventEmitter from 'events'
import dgram from 'dgram'

import Debug from 'debug'
const debug = Debug('fruitmix:smbaudit')

import models from '../models/models'

const logConfigPath = '/etc/rsyslog.d/99-smbaudit.conf'
const logConfig = 'LOCAL7.*    @127.0.0.1:3721'

const userList = () => 
  models.getModel('user').collection.list.filter(user => user.type === 'local')

// xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx <- hyphen and M are removed, then prefixed with letter x
const uuidToUnixName = (uuid) => 
  ['x', ...uuid.split('-').map((s, i) => i === 2 ? s.slice(1) : s)].join('')


// first: retrieve users list from both system, and fruitmix
// second: retrieve users/passwords from both samba, and fruitmix
// third: generate new user map
// fourth: generate new samba configuration
// fifth: reload or restart samba

const retrieveSysUsers = () => {
}

// samba
const detectSamba = (callback) => 
  child.exec('systemctl start nmbd', err => 
    err ? callback(err) : child.exec('systemctl start smbd', err => callback(err)))

// rsyslog
const detectRsyslog = (callback) => {

  const configRsyslog = () =>
    fs.writeFile(logConfigPath, logConfig, err => 
      err ? callback(err) : child.exec('systemctl restart rsyslog', err => callback(err)))

  fs.readFile(logConfigPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT')
        configRsyslog()
      else
        callback(err)
      return
    }

    if (data.toString() === logConfig) 
      return callback(null)

    configRsyslog()  
  })
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

export const createSmbAudit = (callback) => {

  detectSamba(err => {
    if (err) return callback(err)

    detectRsyslog(err => {
      if (err) return callback(err)

      let udp = dgram.createSocket('udp4')
      udp.on('listening', () => 
        callback(null, new SmbAudit(udp))) 
     
      udp.once('error', err => 
        (err.code === 'EADDRINUSE') && callback(err)) 

      udp.bind(3721)
    })
  })
}
