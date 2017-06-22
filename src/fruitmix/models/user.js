const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const bcrypt = require('bcrypt')
const UUID = require('uuid')
const deepFreeze = require('deep-freeze')
const E = require('../lib/error')

const broadcast = require('../../common/broadcast')

const { isUUID, isNonNullObject, isNonEmptyString } = require('../lib/assertion')
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
  "unionId": "ocMvos6NjeKLIBqg5Mr9QjxrP1FA",
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

@prop {string} unionId - WeChat unionId
*/
const userEntryMProps = [
  'uuid', 
  'username', 
  'password', 
  'unixPassword',
  'smbPassword',
  'lastChangeTime',
  'isFirstUser',
  'isAdmin',
  'avatar',
  'unionId'
]

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
@prop {string} unionId - W by user.
*/
const validateUserEntry = u => {


}


/**
UserList manages users.

Internally, opportunistic locc is used to avoid race for transactional file operation.
*/
class UserList extends EventEmitter {

  /**
  Construct an uninitialized UserList. 
  */
  constructor() {

    super()

    this.initialized = false

    this.fpath = undefined

    this.tmpDir = undefined

    /**
    @member {boolean} lock - internal file operation lock
    */
    this.lock = false

    /**
    @member 
    */
    this.users = []
    deepFreeze(this.users)

    broadcast.on('FruitmixStart', froot => {

      let filePath = path.join(froot, 'user.json') 
      let tmpDir = path.join(froot, 'tmp')

      this.init(filePath, tmpDir)
    })

    broadcast.on('FruitmixStop', () => this.deinit())
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
      unionId: user.unionId
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
  Load users from file. If file does not exist, set users to [].

  @param {string} fpath - absolute path of user json file
  @param {string} tmpDir - temp file directory
  @todo do integrity check
  **/
  init(fpath, tmpDir) {

    if (this.initialized) 
      throw new Error('user module already initialized')

    fs.readFile(fpath, (err, data) => {

      if (err) {

        if (err.code === 'ENOENT') {
          this.users = []
        }
        else {
          console.log(err) // TODO
          broadcast.emit('UserInitDone', err)
          return
        }
      } 
      else {

        try {
          this.users = JSON.parse(data)
        }
        catch (err) {
          console.log(err)
          broadcast.emit('UserInitDone', err)
          return
        }
      }

      deepFreeze(this.users) 
      this.fpath = fpath
      this.tmpDir = tmpDir

      this.initialized = true
      broadcast.emit('UserInitDone')
    })
  }

  deinit() {
    
    this.initialized = false 

    this.fpath = undefined
    this.tmpDir = undefined
    this.users = []

    process.nextTick(() => broadcast.emit('UserDeinitDone'))
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

    // get lock
    this.lock = true
    try {

      // save to file
      await saveObjectAsync(this.fpath, this.tmpDir, nextUsers)

      // update in-memory object
      this.users = nextUsers

      // enforce immutability
      deepFreeze(this.users)
    }
    finally {

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
      unionId: null  
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

    let { unionId } = props
    let index = this.users.findIndex(u => u.uuid === uuid) 
    if (index === -1) throw new Error('user not found')

    let nextUser = Object.assign({}, this.users[index], { unionId })
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
  async updatePassword(user, props) {
  } 

  /**
  update a user's union
  */
  async updateWeChatBinding(user, unionId) {
  }
}

module.exports = new UserList()

