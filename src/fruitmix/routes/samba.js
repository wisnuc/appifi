import path from 'path'
import fs from 'fs'
import { Router } from 'express'
import UUID from 'node-uuid'

import models from '../models/models'

const router = Router()

/**

  important !!!!

  user uid must be equal or greater than 2000 AND less than 5000 (exclusive)

**/

let rollover = UUID.v4()

const smbUserList = ()  => {

  let umod = models.getModel('user')

  return umod.collection.list
    .filter(user => user.smbUsername && user.smbPassword && user.smbLastChangeTime)
    .sort((a, b) => a.smbUsername.localeCompare(b.smbUsername))
}


const shareList = (userList) => {

  let umod = models.getModel('user')
  let dmod = models.getModel('drive')
  let ulist = umod.collection.list
  let dlist = dmod.collection.list

  let nmap = new Map()
  ulist.forEach(user => {
    if (user.smbUsername && user.smbPassword && user.smbLastChangeTime)
      nmap.set(user.uuid, user.smbUsername)
  })

  let shares = [] 
  dlist.forEach(drive => {

    if (drive.URI !== 'fruitmix') return
  
    if (drive.fixedOwner === true) {

      let owner = ulist.find(user => user.home === drive.uuid)
      if (owner && owner.smbUsername && owner.smbPassword && owner.smbLastChangeTime) {
        let shareName = owner.smbUsername
        let sharePath = '/drives/' + drive.uuid
        let writelist = [owner.uuid, ...drive.writelist].sort()
          .filter((item, index, array) => !index || item !== array[index - 1])
          .map(uuid => nmap.get(uuid))
          .filter(name => !!name)

        let validUsers = [owner.uuid, ...drive.writelist, ...drive.readlist].sort()        
          .filter((item, index, array) => !index || item !== array[index - 1])
          .map(uuid => nmap.get(uuid))
          .filter(name => !!name)

        shares.push({ name: shareName, path: sharePath, writelist, validUsers })
      }
    } 
    else if (drive.fixedOwner === false) {

      let shareName = drive.uuid
      let sharePath = '/drives/' + drive.uuid 
      
      let writelist = [...drive.owner, ...drive.writelist].sort()
        .filter((item, index, array) => !index || item !== array[index - 1])
        .map(uuid => nmap.get(uuid))
        .filter(name => !!name)

      let validUsers = [...drive.owner, ...drive.writelist, ...drive.readlist].sort()        
        .filter((item, index, array) => !index || item !== array[index - 1])
        .map(uuid => nmap.get(uuid))
        .filter(name => !!name)

      if (validUsers.length > 0) {
        shares.push({ name: shareName, path: sharePath, writelist, validUsers })
      }
    }
  })

  return shares
}

router.get('/rollover', (req, res) => res.status(200).send(rollover.toString()))

router.get('/conf', (req, res) => {

  let global =  '[global]\n' +
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
    '  full_audit:success = mkdir rename rmdir unlink write pwrite \n' + // dont remove write !!!!
    '  full_audit:failure = connect\n' +
    '  full_audit:facility = LOCAL7\n' +
    '  full_audit:priority = ALERT\n\n'   

  let conf = global
  shareList().forEach(share => conf += section(share))
  res.status(200).send(conf)

})

router.get('/createUsers', (req, res) => {
  
  let shebang = '#!/bin/bash\n'

  const line = (name, uid) =>
    'adduser --disabled-password --disabled-login --no-create-home ' +
    `--gecos ",,," --uid ${uid} --gid 0 ${name}\n`

  let uid = 2000

  let script = smbUserList().reduce((prev, curr) => prev + line(curr.smbUsername, uid++), shebang)

  res.status(200).send(script)
})

router.get('/database', (req, res) => {

  const line = (username, userid, password, sec) => 
    `${username}:${userid.toString()}:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:${password.toUpperCase()}:[U          ]:LCT-${sec.toString(16).toUpperCase()}:\n`

  let uid = 2000
  let database = smbUserList().reduce((prev, user) => 
    prev + line(user.smbUsername, uid++, user.smbPassword, user.smbLastChangeTime), '')

  res.status(200).send(database)
})

export default router

