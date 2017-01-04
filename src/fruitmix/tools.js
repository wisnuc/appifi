import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import bcrypt from 'bcrypt'

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
 * Initialize fruitmix in an out-of-band way. Directly write users/drive files to disk.
 * 
 * 1. create wisnuc, fruitmix, models and drives path
 * 2. generate uuids for home and library
 * 3, create home folder and library folder
 * 4. create drives.json model file
 * 5. create users.json model file
 */
const initFruitmixAsync = async (mp, username, password) => {

  console.log('[fruitmix-tools] init fruitmix', mp, username)

  if (!path.isAbsolute(mp))
    throw Object.assign(new Error('requires absolute path as mountpoint'), { code: 'EINVAL' })

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
  await fs.writeFileAsync(usersFile, JSON.stringify(drives, null, '  '))


  // # 90
  // TODO should use tmp file and move methods to ensure integrity (move models folder is a good choice)
}

const initFruitmix = (mp, username, password, callback) =>
  initFruitmixAsync(mp, username, password).asCallback(callback)


/**
 * This function probe fruitmix system as well as its users.
 *
 * all operational errors are return as first arguments in callback. It is up to the caller how to deal
 * with the error message, non-operational errors are returned as data props.

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

  const ambiguous = message => 
    callback(null, { error: { code: 'EAMBIGUOUS', message }})

  const damaged = message => 
    callback(null, { error: { code: 'EDAMAGED', message }})

  if (!path.isAbsolute(mountpoint)) 
    return process.nextTick(() => 
      callback(Object.assign(new Error('requires an absolute path'), { code: 'EINVAL' })))

  let wisnuc = path.join(mountpoint, 'wisnuc') 
  fs.lstat(wisnuc, (err, stats) => {
    if (err && err.code === 'ENOENT') 
      return callback(null, { error: 'ENOWISNUC' })
    if (err) 
      return callback(err)

    if (!stats.isDirectory)
      return callback(null, { error: 'EWISNUCNOTDIR' })

    let fruit = path.join(wisnuc, 'fruitmix')
    fs.lstat(fruit, (err, stats) => {

      if (err && err.code === 'ENOENT') return callback(null, { error: 'ENOFRUITMIX' })
      if (err) return callback(err) 
      if (!stats.isDirectory()) return callback(null, { error: 'EFRUITMIXNOTDIR' })

      let modelsDir = path.join(fruit, 'models')
      fs.lstat(modelsDir, (err, stats) => {

        if (err && err.code === 'ENOENT') return callback(null, { error: 'ENOMODELS' })
        if (err) return callback(err)
        if (!stats.isDirectory()) return callback(null, { error: 'EMODELSNOTDIR' })

        let fpath = path.join(modelsDir, 'users.json')      
        fs.lstat(fpath, (err, stats) => {

          if (err && err.code === 'ENOENT') return callback(null, { error: 'ENOUSERS' })
          if (err) return callback(err) 
          if (!stats.isFile()) return callback(null, { error: 'EUSERSNOTFILE' })

          fs.readFile(fpath, (err, data) => {
            if (err) return callback(err)
            try {
              let users = JSON.parse(data.toString())
              if (!Array.isArray(users))
                return callback(null, { error: 'EUSERSFORMAT' })

              users.forEach(user => {
                delete user.password
                delete user.smbPassword
                delete user.lastChangeTime
              })

              return callback(null, { users })
            }
            catch (e) {
              return callback(null, { error: 'EUSERSPARSE' })
            }
          })        
        })
      })
    })
  })
}

export { md4Encrypt, initFruitmix, probeFruitmix }

