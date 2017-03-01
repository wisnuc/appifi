import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import UUID from 'node-uuid'

import Debug from 'debug'
const debug = Debug('fruitmix:tools')

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

/**
 * Functions in this file are supposed to be used 'statically'.
 *
 * Don't import any dependencies from fruitmix code.
 */

/**
 * Calculate md4 for given text, used for samba password generation or verification
 *
 * @param { string } plain text, empty string is OK
 */
const md4Encrypt = text => 
  crypto.createHash('md4')
    .update(Buffer.from(text, 'utf16le'))
    .digest('hex')
    .toUpperCase()


/**
 * This function prepares folder/file structure before init fruitmix
 *
 * for wisnuc and fruitmix, if exist, if remove is specified, they are removed, except for /wisnuc
 * if they exist and are not folders, and remove is not specified, throw error
 *
 * for models (as well as files inside it), it is NEVER removed, there is no remove option for it.
 * if it exists, it is rename to something like models-20170107T035048588Z, which is models- suffixed
 * with and iso format data string stripped '-', ':', and '.'
 *
 * after preparation, the folder should be
 * (mp)/ no wisnuc, or
 * (mp)/wisnuc no fruitmix, or
 * (mp)/wisnuc/fruitmix no models
 */
const prepareAsync = async (mp, remove) => {

  if (!path.isAbsolute(mp))
    throw Object.assign(new Error('requires absolute path as mountpoint'), { code: 'EINVAL' })

  let wisnuc = path.join(mp, 'wisnuc')
  let fruitmix = path.join(wisnuc, 'fruitmix')
  let models = path.join(fruitmix, 'models')

  let stats
  try {
    stats = await fs.lstatAsync(wisnuc)     
  }
  catch (e) {
    if (e.code === 'ENOENT') return // wisnuc does not exist
    throw e
  }

  if (!stats.isDirectory()) {
    if (remove !== 'wisnuc')
      throw new Error('wisnuc exists and is not a directory')

    await rimrafAsync(wisnuc) 
    return // wisnuc is not a directory and removed
  }
  else {
    if (remove === 'wisnuc') { // wisnuc is directory and force remove
      if (mp === '/')
        throw new Error('wisnuc on root fs cannot be removed. wisnuc system (not user data) is installed here.')

      await rimrafAsync(wisnuc)    
      return // wisnuc is a directory and removed
    } 
  }

  try {
    stats = await fs.lstatAsync(fruitmix)
  }
  catch (e) {
    if (e.code === 'ENOENT') return // fruitmix does not exist
    throw e
  }

  if (!stats.isDirectory()) {
    if (remove !== 'fruitmix')
      throw new Error('fruitmix exists and is not a directory')

    await rimrafAsync(fruitmix)
    return // fruitmix is not a directory and removed
  } 
  else if (remove === 'fruitmix') {
    await rimrafAsync(fruitmix) 
    return // fruitmix is removed
  }
  

  try {
    stats = await fs.lstatAsync(models)
  }
  catch (e) {
    if (e.code === 'ENOENT') return
    throw e 
  }

  // models exists
  let archive = path.join(fruitmix, 'models-' + new Date().toISOString().replace(/(-|:|\.)/g, ''))
  await fs.renameAsync(models, archive)

  return
}

/**
 * Initialize fruitmix in an out-of-band way. Directly write users/drive files to disk.
 * 
 * 1. create wisnuc, fruitmix, models and drives path
 * 2. generate uuids for home and library
 * 3, create home folder and library folder
 * 4. create drives.json model file
 * 5. create users.json model file
 */
const initFruitmixAsync = async ({mp, username, password, remove}) => {

  await prepareAsync(mp, remove)

  console.log('[fruitmix-tools] init fruitmix', mp, username)

  // mkdirp
  let modelsPath = path.join(mp, 'wisnuc', 'fruitmix', 'models')
  await mkdirpAsync(modelsPath)

  // mkdirp
  let drivesPath = path.join(mp, 'wisnuc', 'fruitmix', 'drives')
  await mkdirpAsync(drivesPath)

  // mkdirp
  let uuid = UUID.v4()
  let home = UUID.v4()
  let library = UUID.v4()
  await mkdirpAsync(path.join(drivesPath, home))
  await mkdirpAsync(path.join(drivesPath, library))

  // create drives model
  let drives = [
    {
      label: `${username}-drive`,
      fixedOwner: true,
      URI: 'fruitmix', 
      uuid: home,
      owner: [uuid],
      writelist: [],
      readlist: [],
      cache: true
    },
    {
      label: `${username}-library`,
      fixedOwner: true,
      URI: 'fruitmix', 
      uuid: library,
      owner: [uuid],
      writelist: [],
      readlist: [],
      cache: true
    }
  ]

  // create drive model file
  let drivesFile = path.join(modelsPath, 'drives.json')
  await fs.writeFileAsync(drivesFile, JSON.stringify(drives, null, '  '))

  // create users model
  let salt = bcrypt.genSaltSync(10)
  let encrypted = bcrypt.hashSync(password, salt)
  let md4 = md4Encrypt(password)

  let users = [
    {
      type: 'local',
      uuid: uuid,
      username,
      password: encrypted,
      smbPassword: md4, 
      lastChangeTime: new Date().getTime(),
      avatar: null,
      email: null,
      isAdmin: true,
      isFirstUser: true,
      home,
      library,
      unixUID: 2000
    } 
  ]

  let usersFile = path.join(modelsPath, 'users.json')
  await fs.writeFileAsync(usersFile, JSON.stringify(users, null, '  '))

  return {
    type: 'local',
    uuid: uuid,
    username,
    avatar: null,
    email: null,
    isAdmin: true,
    isFirstUser: true,
    home,
    library,
    unixUID: 2000
  }

  // # 90
  // TODO should use tmp file and move methods to ensure integrity (move models folder is a good choice)
}

const initFruitmix = (args, callback) => initFruitmixAsync(args).asCallback(callback)


/**
 * This function probe fruitmix system as well as its users.
 *
 * all operational errors are return as first arguments in callback. It is up to the caller how to deal
 * with the error message, non-operational errors are returned as data props.
 *

    {
      users: [...]
    }
    
    for:
      wisnuc/fruitmix/models/users.json exists, valid

    or 
    
      {
        error: {
          code: string (may not provided if error from api) 
        }
      }

      ENOWISNUC         // wisnuc folder does not exist
      EWISNUCNOTDIR     // wisnuc folder is not a dir
      ENOFRUITMIX       // fruitmix folder does not exist
      EFRUITMIXNOTDIR   // fruitmix folder is not a dir
      ENOMODELS         // models folder does not exist
      EMODELSNOTDIR     // models folder is not a dir
      ENOUSERS          // users.json file does not exist
      EUSERSNOTFILE     // users.json is not a file
      EUSERSPARSE       // users.json parse fail
      EUSERSFORMAT      // users.json is not well formatted


 * @param {string} mountpoint - must be a valid absolute path. 
 *                              It is considered to be the parent folder for 'wisnuc'
 */
const probeFruitmix = (mountpoint, callback) => {

  const cb = (users, error) => {

    // NOTFOUND
    // AMBIGUOUS
    // DAMAGED
    // READY
    let status = users ? 'READY' :
          ['ENOWISNUC', 'EWISNUCNOTDIR', 'ENOFRUITMIX', 'EFRUITMIXNOTDIR'].includes(error) ? 'NOTFOUND' :
          ['ENOMODELS', 'EMODELSNOTDIR', 'ENOUSERS', 'EUSERSNOTFILE'].includes(error) ? 'AMBIGUOUS' :
          ['EUSERSPARSE', 'EUSERSFORMAT' ].includes(error) ? 'DAMAGED' : null

    let mmap = new Map([
      ['ENOWISNUC', '/wisnuc文件夹不存在'],
      ['EWISNUCNOTDIR', '/wisnuc路径存在但不是文件夹'],
      ['ENOFRUITMIX', '/wisnuc文件夹存在但没有/wisnuc/fruitmix文件夹'],
      ['EFRUITMIXNOTDIR', '/wisnuc/fruitmix路径存在但不是文件夹'],
      ['ENOMODELS', '/wisnuc/fruitmix路径存在但/wisnuc/fruitmix/models文件夹不存在'],
      ['EMODELSNOTDIR', '/wisnuc/fruitmix/models路径存在但不是文件夹'],
      ['ENOUSERS', '/wisnuc/fruitmix/models文件夹存在但users.json文件不存在'],
      ['EUSERSNOTFILE', '/wisnuc/fruitmix/models/users.json路径存在但users.json不是文件'],
      ['EUSERSPARSE', '/wisnuc/fruitmix/models/users.json文件存在但不是合法的JSON格式'],
      ['EUSERSFORMAT', '/wisnuc/fruitmix/models/users.json文件存在但格式不正确']
    ])

    let message = error ? mmap.get(error) : null

    let intact = error === 'ENOWISNUC' || (mountpoint === '/' && 'ENOFRUITMIX')

    callback(null, { status, users, error, message, intact })
  }

  if (!path.isAbsolute(mountpoint)) 
    return process.nextTick(() => 
      callback(Object.assign(new Error('requires an absolute path'), { code: 'EINVAL' })))

  let wisnuc = path.join(mountpoint, 'wisnuc') 
  fs.lstat(wisnuc, (err, stats) => {
    if (err && err.code === 'ENOENT') 
      return cb(null, 'ENOWISNUC')
    if (err) 
      return callback(err)

    if (!stats.isDirectory())
      return cb(null, 'EWISNUCNOTDIR')

    let fruit = path.join(wisnuc, 'fruitmix')
    fs.lstat(fruit, (err, stats) => {

      if (err && err.code === 'ENOENT') return cb(null, 'ENOFRUITMIX')
      if (err) return callback(err) 
      if (!stats.isDirectory()) return cb(null, 'EFRUITMIXNOTDIR')

      let modelsDir = path.join(fruit, 'models')
      fs.lstat(modelsDir, (err, stats) => {

        if (err && err.code === 'ENOENT') return cb(null, 'ENOMODELS')
        if (err) return callback(err)
        if (!stats.isDirectory()) return cb(null, 'EMODELSNOTDIR')

        let fpath = path.join(modelsDir, 'users.json')      
        fs.lstat(fpath, (err, stats) => {

          if (err && err.code === 'ENOENT') return cb(null, 'ENOUSERS')
          if (err) return callback(err) 
          if (!stats.isFile()) return cb(null, 'EUSERSNOTFILE')

          fs.readFile(fpath, (err, data) => {

            debug('users.json readfile', err || data)

            if (err) return callback(err)

            let users
            try {
              users = JSON.parse(data.toString())
            }
            catch (e) {
              return cb(null, 'EUSERSPARSE')
            }

            if (!Array.isArray(users))
              return cb(null, 'EUSERSFORMAT')

            users.forEach(user => {
              delete user.password
              delete user.smbPassword
              delete user.lastChangeTime
            })

            return cb(users, null)
          })        
        })
      })
    })
  })
}

export { md4Encrypt, initFruitmix, probeFruitmix }

