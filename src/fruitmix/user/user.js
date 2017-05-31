const path = require('path')
const fs = Promise.promisify(requrie('fs'))
const EventEmitter = require('events')

const UUID = require('uuid')
const deepFreeze = require('deep-freeze')
const E = require('../lib/error')

const { isUUID } = require('../lib/is')

/**
User module maintains user list like a database.

### Description

#### Change

In this version. `user` and `drive` are split into two modules. 

(`user`, `drive`) relationship is defined as a dependent relationship and is maintained in `drive` module. Hence there are no home, library, service, etc props in user data structure.

### User Object Types

There are several types of user object. 

+ UserEntry includes full user information is used in this module. 
+ User is used by other parts of fruitmix. Some internal information are removed.
+ UserSmb is used for samba.
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

@typedef {Object} UserRecord
@prop {string} uuid - user's identity in station domain.
@prop {string} username - user's display name (not identity).
@prop {number} unixuid - user's unix user id, automatically allocated.
@prop {string} unixname - user's unix user name, automatically generated or manually set by user.

@prop {string} password - user password.
@prop {string} unixPassword - user's unix password (/etc/passwd).
@prop {string} smbPassword - user's samba password (md4).
@prop {number} lastChangeTime - last password change time, required by samba.

@prop {boolean} isFirstUser - first user is the most privileged user.
@prop {boolean} isAdmin - privileged user.
@prop {boolean} nologin - the user is forbidden.

@prop {(null|string)} email - email address, not used. null
@prop {(null|string)} avatar - avatar identity, not used. null

@prop {string} unionId - WeChat unionId
*/



const userEntryMProps = [
  'uuid', 
  'username', 
  'unixuid', 
  'unixname', 
  'password', 
  'unixPassword',
  'smbPassword',
  'lastChangeTime',
  'isFirstUser',
  'isAdmin',
  'nologin',
  'email',
  'avatar',
  'unionId'
]

/**
User includes a subset of props in UserEntry. It is used by other parts of fruitmix.

Prop description are not repeated here. Instead, RW authorization is described here.

Besides the following props, password is a prop when user serviced as restful resource. It is writable by user.

@typedef {Object} User
@prop {string} uuid - RO
@prop {string} username - W by user.
@prop {number} unixuid - RO (module maintained)
@prop {string} unixname - RO (module maintained)

@prop {boolean} isFirstUser - RO
@prop {boolean} isAdmin - W by first user.
@prop {boolean} nologin - For admin, W by first user. For non-privileged user, W by admin. For first user, RO.

@prop {(null|string)} email - RO now.
@prop {(null|string)} avatar - RO now.

@prop {string} unionId - W by user.
*/

const validateUserEntry = u => {


}

/**
UserList manages users.

Internally, UserList uses lock to avoid race on file operation.
*/
class UserList {

  /**
  @param {string} path - absolute path of user list file (file name is users.json)
  @param {string} tmpDir - temp file directory
  */
  constructor(path, tmpDir) {

    this.path = path
    this.tmpDir = tmpDir

    this.users = []

    deepFreeze(this.users)
    this.lock = false
  }

  getLock() {
    if (this.lock === true) throw new E.ELOCK('locked')
    this.lock = true
  }

  putLock() {
    if (this.lock === false) throw new E.ELOCK('not locked')
    this.lock = false
  }

  /** load users from file **/
  async initAsync() {
    
  }

  /**
  create a user
  @param {User} user - operator
  @param {Object} props - props
  @param {string} props.username - non-empty string, no conflict with existing username
  @param {string} props.password - non-empty string
  @param {boolean} [props.isAdmin] - set new user's isAdmin. Operator must be first user to have this prop.
  */
  async createUser(user, props) {

    if (user.isAdmin) throw E.EACCESS('only admin can create a new user') 

    let newUser = {

      uuid: UUID.v4(),
      username: props.username,
      unixuid: this.allocateUnixUID(),
      unixname: null,
      password: passwordEncrypt(props.password, 10),
      unixPassword: unixPasswordEncrypt(props.password),
      smbPassword: md4Encrypt(password),
      lastChangeTime: new Date().getTime(),
      isFirstUser: this.users.length === 0 ? true : false,
      isAdmin: false,
      nologin: false,
      email: null,
      avatar: null,
      unionId: null  
    } 

    return newUser
  }

  /**
  update a user

  @param {User} user - operator
  @param {Object} props - props
  @param {string} props.username - non-empty string, no conflict with existing username
  @param {boolean} [props.isAdmin] - set user's isAdmin. Operator must be first user to have this prop.
  @param {boolean} [props.nologin] - set user's nologin. Operator must be 
  **/
  async updateUser(user, props) {
  }

  async updatePassword(user, props) {
  } 

  /**
  update a user's union
  */
  async updateWeChatBinding(user, unionId) {
  }
}


