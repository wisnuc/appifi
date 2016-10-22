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


const userList = ()  => {

  let umod = models.getModel('user')
  return umod.collection.list.sort((a, b) => a.uuid.localeCompare(b.uuid))
}


// xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx <- hyphen and M are removed, then prefixed with letter x
const uuidToUnixName = (uuid) => 
  ['x', ...uuid.split('-').map((s, i) => i === 2 ? s.slice(1) : s)].join('')

const shareList = (userList) => {

  let umod = models.getModel('user')
  let dmod = models.getModel('drive')
  let ulist = umod.collection.list
  let dlist = dmod.collection.list

  let shares = [] 
  dlist.forEach(drive => {

    if (drive.URI !== 'fruitmix') return
  
    if (drive.fixedOwner === true) {

      let owner = ulist.find(user => user.home === drive.uuid)
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

        shares.push({ name: shareName, path: sharePath, writelist, validUsers })
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

router.get('/rollover', (req, res) => {

  let umod = models.getModel('user')
  let dmod = models.getModel('drive')

  let rollover = umod.hash + ':' + dmod.hash

  res.status(200).send(rollover)
})

router.get('/conf', (req, res) => {

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

  // create_file issue multiple message

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

  let script = userList().reduce((prev, curr) => prev + line(uuidToUnixName(curr.uuid), uid++), shebang)

  res.status(200).send(script)
})

router.get('/database', (req, res) => {

  const line = (username, userid, password, sec) => 
    `${username}:${userid.toString()}:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:${password.toUpperCase()}:[U          ]:LCT-${sec.toString(16).toUpperCase()}:\n`

  let uid = 2000
  let database = userList().reduce((prev, user) => 
    prev + line(uuidToUnixName(user.uuid), uid++, user.smbPassword, Math.floor(user.lastChangeTime / 1000)), '')

  res.status(200).send(database)
})

router.get('/usernamemap', (req, res) => {

  let map = userList().reduce((prev, user) => prev + `${uuidToUnixName(user.uuid)} = "${user.username}"\n`, '')
  res.status(200).send(map)
})

export default router

