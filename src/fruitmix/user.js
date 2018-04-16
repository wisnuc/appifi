const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const bcrypt = require('bcrypt')
const UUID = require('uuid')
const deepFreeze = require('deep-freeze')
const E = require('../lib/error')

const { isUUID, isNonNullObject, isNonEmptyString, isSHA256 } = require('../lib/assertion')
const { saveObjectAsync, passwordEncrypt, unixPasswordEncrypt, md4Encrypt } = require('../lib/utils')

/**
User module exports a UserList Singleton.

### Description

#### Change

In this version. `user` and `drive` are split into two modules. 

(`user`, `drive`) relationship is defined as a dependent relationship and is maintained in `drive` module. Hence there are no home, library, service, etc props in user data structure.

All user props that are not related to fruitmix are removed, except for passwords. UnixUID should be maintained externally.

### User Object Types

There are several types of user object. 

+ UserEntry includes full user information is used in this module. 
+ User is used by other parts of fruitmix. Some internal information are removed.
+ UserBasic is used for login.

See Type section for detail.

#### WeChatUser

WeChatUser is provided by wisnuc cloud.

```
data = {
  "nickName": "Band",
  "gender": 1,
  "language": "zh_CN",
  "city": "Guangzhou",
  "province": "Guangdong",
  "country": "CN",
  "avatarUrl": "http://wx.qlogo.cn/xxxx",
  "guid": "ocMvos6NjeKLIBqg5Mr9QjxrP1FA",
  "watermark": {
    "timestamp": 1477314187,
    "appid": "wx4f4bc4dec97d474b"
  }
}
```

@module User
*/

/**
UserEntry represents an entry in user list, like a record in a database table. It includes full information for a user.

All props defined below are mandatory. If there is no value assigned, it should be null, not undefined.

@typedef {Object} UserEntry
@prop {string} uuid - user's identity in station domain.
@prop {string} username - user's display name (not identity).

@prop {string} password - user password.
@prop {string} unixPassword - user's unix password (/etc/passwd).
@prop {string} smbPassword - user's samba password (md4).
@prop {number} lastChangeTime - last password change time, required by samba.

@prop {boolean} isFirstUser - first user is the most privileged user.
@prop {boolean} isAdmin - privileged user.

@prop {(null|string)} avatar - avatar identity, not used. null

@prop {object} global - global
*/
// TODO: disabled

const userEntryMProps = [
  'uuid', 
  'username', 
  'password', 
  'unixPassword',
  'smbPassword',
  'lastChangeTime',
  'isFirstUser',
  'isAdmin',
  'disabled',
  'avatar',     // null
  'global'      // { id, wx: [ <unionId> ] }
]

const assert = (predicate, message) => {
  if (!predicate)
    throw Object.assign(new Error(message), { status: 403 });
}

const unique = arr => new Set(arr).size === arr.length

const isUniqueUUIDArray = arr => unique(arr)
  && (arr.every(i => isUUID(i)) || arr.length === 0)

const arrayEqual = (arr1, arr2) => arr1.length === arr2.length
  && arr1.every((item, index) => item === arr2[index])

const complement = (a, b) => 
  a.reduce((acc, c) => b.includes(c) 
    ? acc 
    : [...acc, c], [])

const validateProps = (obj, mandatory, optional = []) => 
  complement(Object.keys(obj), [...mandatory, ...optional]).length === 0 &&
  complement(mandatory, Object.keys(obj)).length === 0


/**
User includes all props in UserEntry except from password related ones. It is used by other parts of fruitmix.

Prop description are not repeated here. Instead, RW authorization is described here.

Besides the following props, password is a prop when user serviced as restful resource. It is writable by user.

@typedef {Object} User
@prop {string} uuid - FIXED
@prop {string} username - W by user or Admin.
@prop {boolean} isFirstUser - FIXED
@prop {boolean} isAdmin - W by first user.
@prop {(null|string)} avatar - FIXED now.
@prop {object} global - W by station
*/

const userGlobalProps = ['id', 'wx']

// FIXME: old user's disabled undefined
const validateUserEntry = u => {
  if(u.disabled === undefined) u.disabled = false // add disabled property
  assert(validateProps(u, userEntryMProps), 'invalid object props')
  assert(isUUID(u.uuid), 'invalid user uuid')
  assert(isNonEmptyString(u.username), 'username must be non-empty string')
  assert(isNonEmptyString(u.password), 'password must be non-empty string')
  assert(isNonEmptyString(u.unixPassword), 'password must be non-empty string')
  assert(isNonEmptyString(u.smbPassword), 'password must be non-empty string')
  assert(typeof u.isFirstUser === 'boolean', 'isFirstUser must be boolean')
  assert(typeof u.isAdmin === 'boolean', 'isAdmin must be boolean')
  assert(typeof u.disabled === 'boolean' || typeof u.disabled === 'undefined', 'disabled must be boolean')
  assert(Number.isInteger(u.lastChangeTime), 'lastChangeTime must be integer')
  assert(u.avatar === null ? true : isSHA256(u.avatar), 'avatar must be null or sha256')
  assert(u.global === null ? true : validateProps(u.global, userGlobalProps), 'global must be null or { id, wx: [ <unionId> ] }')
  return true
}

const validateUsers = users => {
  if(!users.length) return

  assert(users.every(u => validateUserEntry(u)), 'invalid user')

  assert(isUniqueUUIDArray(users.map(u => u.uuid)))
  
  assert(users.filter(u => u.isFirstUser === true).length === 1, 'single first user')

  assert(users.find(u => u.isFirstUser).isAdmin === true, 'first user must be admin')
}

class State {
  
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this

    debug('=== entering ===', this.constructor.name)
    this.enter(...args)
    debug('=== entered ===', this.constructor.name)

    this.ctx.emit('StateEntered', this.constructor.name)
  }

  setState (State, ...args) {
  }
}

/**
@event UserInitDone
@global
*/

/**
@event UserDeinitDone
@global
*/

/**
UserList manages users.

Internally, opportunistic lock is used to avoid race for transactional file operation.
*/
class UserList extends EventEmitter {

  /**
  */
  constructor(froot) {

    super()

    this.filePath = path.join(froot, 'users.json')
    this.tmpDir = path.join(froot, 'tmp')

    try {
      this.users = JSON.parse(fs.readFileSync(this.filePath))
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      this.users = []
    }

    validateUsers(this.users)

    // TODO validate
    deepFreeze(this.users)

    /**
    @member {boolean} lock - internal file operation lock
    */
    this.lock = false
  }

  /**
  Strip off sensitive information in user

  @param {UserEntry} user
  */
  stripUser(user) {
    return {
      uuid: user.uuid,
      username: user.username,
      isFirstUser: user.isFirstUser,
      isAdmin: user.isAdmin,
      avatar: user.avatar,
      disabled: user.disabled,
      global: user.global
    }
  }
  
  findUser(uuid) {
    let user = this.users.find(u => u.uuid === uuid)       
    if (user) return this.stripUser(user)
  }

  verifyPassword(userUUID, password, done) {

    let user = this.users.find(u => u.uuid === userUUID)
    if (!user) return done(new Error('user not found'))

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return done(err) 
      match ? done(null, this.stripUser(user)) : done(null, false) 
    })
  }

  /**
  Save users to file. This operation use opportunistic lock.

  @param {Object} currUsers - current users, should be preserved right before transactional update
  @param {Object} nextUsers - next users, object created during transactional update
  */
  async commitUsersAsync(currUsers, nextUsers) {

    // referential equality check
    if (currUsers !== this.users) throw E.ECOMMITFAIL()

    // check atomic operation lock
    if (this.lock === true) throw E.ECOMMITFAIL()
    
    //validate
    validateUsers(nextUsers)

    // get lock
    this.lock = true
    try {

      // save to file
      await saveObjectAsync(this.filePath, this.tmpDir, nextUsers)

      // update in-memory object
      this.users = nextUsers

      // enforce immutability
      deepFreeze(this.users)
    } finally {
      // notify
      broadcast.emit('UserListChanged', null)
      // put lock
      this.lock = false
    }
  }

  /**
  */
  async migrateAsync() {
  }


  /**
  Create a user

  @param {Object} props - props
  @param {string} props.username - non-empty string, no conflict with existing username
  @param {string} props.password - non-empty string
  @param {boolean} [props.isAdmin] - set new user's isAdmin. For first user, this props is forced to be true
  */
  async createUserAsync(props) {

    if (!isNonNullObject(props)) throw E.EINVAL('props must be non-null object')
    if (!isNonEmptyString(props.username)) throw E.EINVAL('username must be non-empty string')

    let currUsers = this.users

    let isFirstUser = this.users.length === 0 ? true : false
    let isAdmin = isFirstUser ? true : props.isAdmin === true ? true : false
    let global = props.global ? props.global : null
    let newUser = {

      uuid: UUID.v4(),
      username: props.username,
      password: passwordEncrypt(props.password, 10),
      unixPassword: unixPasswordEncrypt(props.password),
      smbPassword: md4Encrypt(props.password),
      lastChangeTime: new Date().getTime(),
      isFirstUser,
      isAdmin,
      avatar: null,
      disabled: false,
      global
    } 

    let nextUsers = [...currUsers, newUser]
    await this.commitUsersAsync(currUsers, nextUsers)
    return this.stripUser(newUser)
  }

  /**
  Update a user

  @param {Object} props - props
  @param {string} props.username - non-empty string, no conflict with existing username
  @param {boolean} [props.isAdmin] - set user's isAdmin. Operator must be first user to have this prop.
  **/
  async updateUserAsync (uuid, props) {

    let currUsers = this.users

    let index = this.users.findIndex(u => u.uuid === uuid) 
    if (index === -1) throw new Error('user not found')

    let nextUser = Object.assign({}, this.users[index], props)
    let nextUsers = [
      ...currUsers.slice(0, index),
      nextUser,
      ...currUsers.slice(index + 1)
    ] 

    await this.commitUsersAsync(currUsers, nextUsers)
    return this.stripUser(nextUser)
  }

  /**
  */
  async updatePasswordAsync(userUUID, password) {

    let currUsers = this.users
    let index = this.users.findIndex(u => u.uuid === userUUID)
    if (index === -1) throw new Error('user not found')

    let nextUser = Object.assign({}, this.users[index], {
      password: passwordEncrypt(password, 10),
      unixPassword: unixPasswordEncrypt(password),
      smbPassword: md4Encrypt(password),
      lastChangeTime: new Date().getTime(),
    })

    let nextUsers = [
      ...currUsers.slice(0, index),
      nextUser,
      ...currUsers.slice(index + 1)
    ] 

    await this.commitUsersAsync(currUsers, nextUsers)
  } 


}

module.exports = UserList

