import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import EventEmitter from 'events'

import Debug from 'debug'
const debug = Debug('fruitmix:userModel')

// import bcrypt from 'bcryptjs'
import bcrypt from 'bcrypt'
import UUID from 'node-uuid'
import validator from 'validator'
import mkdirp from 'mkdirp'

import { throwBusy, throwInvalid } from '../util/throw'
import { openOrCreateCollectionAsync} from './collection'

Promise.promisifyAll(fs)

const isUUID = (x) => typeof x === 'string' && validator.isUUID(x)

const md4Encrypt = (text) => 
  crypto.createHash('md4')
    .update(Buffer.from(text, 'utf16le'))
    .digest('hex')
    .toUpperCase()


/** Schema
{

*   type: // string, 'local' or 'remote'

    uuid: { type: String, unique: true, required: true },
*   username: { type: String, unique: true, required: true },
x   password: { type: String, required: true },
x   smbPassword:
x   smbLastChangeTime:

o   avatar: { type: String, required: true },
o   email: { type: String, unique: true },

o1  isAdmin: { type: Boolean },
    isFirstUser: { type: Boolean },

    home: // home drive uuid (auto generated when creating)
    library: // library drive uuid (auto generated when creating)
}

Note: 
o1  neglected for first user 

**/

/** Schema Patch
{

x   type: // string, 'local' or 'remote'

x   uuid: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
x   smbPassword:
x   smbLastChangeTime:

    avatar: { type: String, required: true },
    email: { type: String, unique: true },

o1  isAdmin: { type: Boolean },
    isFirstUser: { type: Boolean },

x   home: // home drive uuid (auto generated when creating)
x   library: // library drive uuid (auto generated when creating)
}

Note: 
o1  can only be changed by first user

**/

Promise.promisifyAll(bcrypt)

// TODO
const validateAvatar = (avatar) => true

class UserModel extends EventEmitter{

  constructor(collection) {
    super()
    this.collection = collection
    this.increment = 2000
    this.eset = new Set()
    this.hash = UUID.v4()

    this.collection.list.forEach(user => {
      if (user.type === 'local')
        this.eset.add(user.unixUID)
    })
  }

  allocUnixUID() {
    while (this.eset.has(this.increment)) this.increment++
    return this.increment++
  }

  createUser(props, callback) {

    const einval = (text) => 
      process.nextTick(callback, Object.assign(new Error(text), { code: 'EINVAL' }))
    const ebusy = (text) => 
      process.nextTick(callback, Object.assign(new Error(text), { code: 'EBUSY' })) 

    let list = this.collection.list
    let {
      type,         // *
      username,     // *
      password,     // *
      avatar,       // o
      email,        // o
      isAdmin,      // o
    } = props

    if (type !== 'local' && type !== 'remote')
      return einval('invalid user type')
    if (typeof username !== 'string' || !username.length || list.find(u => u.username === username))
      return einval('invalid username')
    if (typeof password !== 'string' || !password.length)
      return einval('invalid password')

    if (avatar && (typeof avatar !== 'string' || avatar.length === 0))
      return einval('invalid avatar')

    avatar = avatar || null

    if (email && (typeof email !== 'string' || !validator.isEmail(email)))
      return einval('invalid email')
    
    email = email || null

    if (isAdmin && typeof isAdmin !== 'boolean')    
      return einval('invalid isAdmin, must be true or false')

    isAdmin = isAdmin || false

    let uuid = UUID.v4()
    let salt = bcrypt.genSaltSync(10) 
    let passwordEncrypted = bcrypt.hashSync(password, salt)
    let smbPasswordEncrypted = md4Encrypt(password)
    let lastChangeTime = new Date().getTime()

    if (this.collection.locked) 
      return ebusy('locked')

    let isFirstUser = list.length === 0 ? true : false  
    if (isFirstUser) isAdmin = true

    let newUser = {
      type, 
      uuid: UUID.v4(),
      username, 
      password: passwordEncrypted, 
      smbPassword: smbPasswordEncrypted,
      lastChangeTime,
      avatar,
      email,
      isAdmin,
      isFirstUser,
      home: UUID.v4(),
      library: UUID.v4()
    }

    if (newUser.type === 'local')
      newUser.unixUID = this.allocUnixUID()

    this.collection
      .updateAsync(list, [...list, newUser]) 
      .asCallback(err => { 
        if (err) return callback(err) 
        this.hash = UUID.v4()
        process.nextTick(() => this.emit('userCreated', newUser))
        callback(null, newUser)
      }) 

    this.emit('userAdded', newUser)
  }

  updateUser(userUUID, props, callback) {

    const einval = (text) => 
      process.nextTick(callback, Object.assign(new Error(text), { code: 'EINVAL' }))
    const enoent = (text) => 
      process.nextTick(callback, Object.assign(new Error(text), { code: 'ENOENT' })) 

    let list = this.collection.list
    let user = list.find(u => u.uuid === userUUID) 
    if (!user) 
      return enoent('user not found')

    // only following field are allowed 
    // username
    // password
    // avatar
    // email

    let { username, password, smbUsername, smbPassword, avatar, email } = props
    
    let change = {}

    // username
    if (username) {
      if (typeof username !== 'string' || !username.length || 
        list.filter(u => u.uuid !== userUUID).find(other => other.username === username)) 
        return einval('invalid username')
      change.username = username
      change.lastChangeTime = new Date().getTime()
    }

    // password
    if (password) {
      if (password !== 'string' || !password.length) 
        return einval('invalid password')
      change.password = bcrypt.hashSync(password, bcrypt.genSaltSync(10))
      change.smbPassword = md4Encrypt(password)
      change.lastChangeTime = new Date().getTime()
    }

    // avatar
    if (avatar === undefined) {}
    else if (avatar === null)
      change.avatar = null
    else if (typeof avatar === 'string' && !avatar.length)
      change.avatar = avatar
    else
      return einval('invalid avatar')

    // email 
    if (email === undefined) {}
    else if (email === null) 
      change.email = null
    else if (typeof email === 'string' && !email.length)
      change.email = email
    else 
      return einval('invalid email')

    // merge
    let update = Object.assign({}, user, change)
    let index = list.findIndex(u => u.uuid === userUUID)
  
    this.collection
      .updateAsync(list, [...list.slice(0, index),  update, ...list.slice(index + 1)])
      .asCallback(err => {
        if (err) return callback(err)
        this.hash = UUID.v4()
        process.nextTick(() => this.emit('userUpdated', user, update))
        callback(null, update)
      })

    this.emit('userUpdated', user, update)
  }

  // to be refactored
  async deleteUser(uuid) {

    if(typeof uuid !== 'string') throwInvalid('invalid uuid')
    if(this.collection.locked) throwBusy()

    let user = this.collection.list.find(u => u.uuid === uuid)
    if (!user) throw Object.assign(new Error(`delete user: uuid ${uuid} not found`), { code: 'ENOENT' })

    await this.collection.updateAsync(this.collection.list, 
      this.collection.list.filter(u => u !== user))

    this.emit('userDeleted', user)
  }

  // 
  verifyPassword(useruuid, password, callback) {
    
    let user = this.collection.list.find(u => u.uuid === useruuid)
    if (!user) 
      return process.nextTick(() => callback(null, null))

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return callback(err) 
      match ? callback(null, user) : callback(null, null) 
    })
  }
}

const createUserModel = (filepath, tmpdir, callback) => 
  createUserModelAsync(filepath, tmpdir).asCallback((err, result) => 
    callback(err, result))

const createUserModelAsync = async (filepath, tmpfolder) => {

  let collection = await openOrCreateCollectionAsync(filepath, tmpfolder) 
  if (collection) {

    debug(list)

    let list = collection.list
    let locals = list.filter(user => user.type === 'local')

    let eset = new Set() // store uid
    let uarr = [] // store user to be processed, no unixUID or duplicate/out-of-range uid 

    locals.forEach(user => {

      // invalid
      if (!Number.isInteger(user.unixUID)) uarr.push(user)
      // out-of-range
      if (user.unixUID < 2000 || user.unixUID >= 10000) uarr.push(user)
      // existing 
      if (eset.has(user.unixUID)) uarr.push(user)

      eset.add(user.unixUID)
    })

    let count = 2000
    const alloc = () => {
      while (eset.has(count)) count++
      return count
    }
    
    uarr.forEach(user => user.unixUID = alloc()) 

    debug(list)

    await collection.updateAsync(list, list)
    return new UserModel(collection)
  }
  return null
}

// external use
const createFirstUser = (mp, username, password, callback) => {

  let salt = bcrypt.genSaltSync(10)
  let encrypted = bcrypt.hashSync(password, salt)
  let md4 = md4Encrypt(password)

  let users = [
    {
      type: 'local',
      uuid: UUID.v4(),
      username,
      password: encrypted,
      smbPassword: md4, 
      smbLastChangeTime: new Date().getTime(),
      avatar: null,
      email: null,
      isAdmin: true,
      isFirstUser: true,
      home: UUID.v4(),
      library: UUID.v4()
    } 
  ]

  debug('creating first user', users[0])

  let dir = path.join(mp, 'wisnuc', 'fruitmix', 'models')
  mkdirp(dir, err => {

    if (err) return callback(err)
    fs.writeFile(path.join(dir, 'users.json'), 
      JSON.stringify(users, null, '  '), err => {
      
      err ? callback(err) : callback(null, users[0])
    })
  })
}

export { createUserModelAsync, createUserModel, createFirstUser }



