const EventEmitter = require('events')
const UUID = require('uuid')
const { isUUID, isNonNullObject, isNonEmptyString } = require('../lib/assertion')
const DataStore = require('../lib/DataStore')
const { passwordEncrypt, md4Encrypt } = require('../lib/utils') // eslint-disable-line
const request = require('superagent')
const debug = require('debug')('appifi:user')

const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DELETED: 'DELETED'
}

const INACTIVE_REASON = {
  IMPORT: 'import',
  TIMEOUT: 'timeout',
  REJECT: 'reject'
}

/**
 * user in INACTIVE state
 * * user object have `reason` property
 *    * if `reason` equal number `import`, becourse of import
 *    * if equal number `timeout`, because of invite timeout
 * * admin do
 */

/**
 * user in ACTIVE state
 * * user object have `itime` property
 *    * user have not be confirmed
 * * active user
 */

/**

The corresponding test file is test/unit/fruitmix/user.js

Using composition instead of inheritance.
*/
class User extends EventEmitter {
  /**
  Create a User

  Add other properties to opts if required.

  @param {object} opts
  @param {string} opts.file - path of users.json
  @param {string} opts.tmpDir - path of tmpDir (should be suffixed by `users`)
  @param {boolean} opts.isArray - should be true since users.json is an array
  */
  constructor (opts) {
    super()
    this.conf = opts.configuration
    this.cloudConf = opts.cloudConf
    this.fruitmixDir = opts.fruitmixDir
    this.store = new DataStore({
      file: opts.file,
      tmpDir: opts.tmpDir,
      isArray: true
    })

    // observe boundVolume change
    if (opts.boundVolumeId) {
      this.chassisId = opts.boundVolumeId
      this.chassisStore = new DataStore({
        file: opts.chassisFile,
        tmpDir: opts.chassisTmpDir,
        isArray: true
      })
      this.chassisStore.on('Update', this.chassisUpdate.bind(this))

      Object.defineProperty(this, 'chassis', {
        get () {
          return this.chassisStore.data || []
        }
      })
    }

    this.store.on('Update', (...args) => this.emit('Update', ...args))

    Object.defineProperty(this, 'users', {
      get () {
        return this.store.data || []
      }
    })

    // start polling cloud users status
    this.lookupCloudUsers()
  }

  chassisUpdate () {
    if (!this.chassisId) return
    if (!this.chassis.length) {
      return this.chassisStore.save(data => {
        return [this.chassisId]
      }, () => {})
    }
    let lastChassisId = this.chassis[0]
    if (lastChassisId !== this.chassisId) {
      this.store.save(users => {
        users.filter(u => u.status === USER_STATUS.ACTIVE)
          .forEach(u => {
            if (!u.isFirstUser) {
              u.status = USER_STATUS.INACTIVE
              u.reason = INACTIVE_REASON.IMPORT
              u.password = undefined
              u.smbPassword = undefined
            }
          })
        console.log('chassisId change:', users)
        return users
      }, err => {
        if (err) return console.log('update users to INACTIVE status error', err)
        return this.chassisStore.save(data => {
          return [this.chassisId, ...data]
        }, () => {})
      })
    }
  }

  /**
   * lookupCloudUsers
   * 定期每十分钟轮训一次云端
   * 获取用户左箭头列表
   * 排查邀请用户中，超时或拒绝的用户
   * 把这些用户的状态设置为`inactive`且设置原因
   */
  lookupCloudUsers () {
    setInterval(() => {
      if (this.cloudConf.cloudToken) {
        debug(this.cloudConf.cloudToken)
        request
          .get('http://sohon2test.phicomm.com/StationManager/nas/getInfo')
          .set('Authorization', this.cloudConf.cloudToken)
          .end((err, res) => {
            if (err || (res.body && res.body.error !== '0')) return debug(err)
            debug('lookupCloudUsers: ', res.body)
            if (!res.body.result || !Array.isArray(res.body.result.userList)) return
            let result = res.body.result.userList.filter(u => u.inviteStatus === 'timeout' || u.inviteStatus === 'reject')
            if (!result.length) return
            this.storeSave(users => {
              result.forEach(r => {
                let user = users.find(u => u.phicommUserId === r.uid && u.status === USER_STATUS.ACTIVE)
                if (user) {
                  user.status = USER_STATUS.INACTIVE
                  user.reason = r.inviteStatus === 'timeout' ? INACTIVE_REASON.TIMEOUT : INACTIVE_REASON.REJECT
                }
              })
              return [...users]
            }, err => err ? debug('lookupCloudUsers failed:', err) : debug('lookupCloudUsers success'))
          })
      }
    }, 1000 * 60 * 10)
  }

  getUser (userUUID) {
    return this.users.find(u => u.uuid === userUUID && u.status !== USER_STATUS.DELETED)
  }

  /**
   * data 为数组或者方法
   * 所有的存储任务提交前先检查约束条件是否都过关
   */
  storeSave (data, callback) {
    this.store.save(users => {
      let changeData = typeof data === 'function' ? data(users) : data
      // check rules
      if (changeData) {
        if (changeData.filter(u => u.status === USER_STATUS.ACTIVE).length > 10) {
          throw Object.assign(new Error('active users max 10'), { status: 400 })
        }
      }
      // clean reason
      changeData.forEach(u => {
        if (u.status !== USER_STATUS.INACTIVE && u.reason) {
          u.reason = undefined
        }
      })
      return changeData
    }, callback)
  }

  /**

  TODO lastChangeTime is required by smb
  TODO createTime is required by spec
  */
  createUser (props, callback) {
    let uuid = UUID.v4()
    this.storeSave(users => {
      let isFirstUser = users.length === 0
      let { username, phicommUserId, password, smbPassword, phoneNumber } = props // eslint-disable-line

      let cU = users.find(u => u.username === username)
      if (cU && cU.status !== USER_STATUS.DELETED) throw new Error('username already exist')
      let pU = users.find(u => u.phicommUserId === phicommUserId)
      if (pU && pU.status !== USER_STATUS.DELETED) throw new Error('phicommUserId already exist')
      let pnU = users.find(u => u.phoneNumber === phoneNumber)
      if (pnU && pnU.status !== USER_STATUS.DELETED) throw new Error('phoneNumber already exist')

      let newUser = {
        uuid,
        username: props.username,
        isFirstUser,
        phicommUserId: props.phicommUserId,
        password: props.password,
        smbPassword: props.smbPassword,
        status: USER_STATUS.ACTIVE,
        createTime: new Date().getTime(),
        lastChangeTime: new Date().getTime(),
        phoneNumber: props.phoneNumber,
        itime: new Date().getTime() // inviteTime, serve for check invite timeout
      }
      return [...users, newUser]
    }, (err, data) => {
      if (err) return callback(err)
      return callback(null, data.find(x => x.uuid === uuid))
    })
  }

  updateUser (userUUID, props, callback) {
    let { username, status, phoneNumber, smbPassword } = props
    this.storeSave(users => {
      let index = users.findIndex(u => u.uuid === userUUID)
      if (index === -1) throw new Error('user not found')
      let nextUser = Object.assign({}, users[index])
      if (nextUser.status === USER_STATUS.DELETED) throw new Error('deleted user can not update')
      if (username) {
        if (users.find(u => u.username === username && u.status !== USER_STATUS.DELETED)) throw new Error('username already exist')
        nextUser.username = username
      }
      if (phoneNumber) {
        if (users.find(u => u.phoneNumber === phoneNumber && u.status !== USER_STATUS.DELETED)) throw new Error('phoneNumber already exist')
        nextUser.phoneNumber = phoneNumber
      }
      if (smbPassword) {
        nextUser.smbPassword = md4Encrypt(smbPassword)
        nextUser.lastChangeTime = new Date().getTime()
      }
      if (status) nextUser.status = status
      return [...users.slice(0, index), nextUser, ...users.slice(index + 1)]
    }, (err, data) => {
      if (err) return callback(err)
      return callback(null, data.find(x => x.uuid === userUUID))
    })
  }

  /**
  * TODO: to be test
  * request bootstrap
  * @param {string} userUUID
  * @param {object} props { password, encrypted }  - if true, both passwords are considered to be encrypted
  * @param {function} callback
  */
  updatePassword (userUUID, props, callback) {
    try {
      if (!isUUID(userUUID)) throw new Error(`userUUID ${userUUID} is not a valid uuid`)
      if (!isNonNullObject(props)) throw new Error('props is not a non-null object')
      if (!isNonEmptyString(props.password)) throw new Error('password must be a non-empty string if provided')
      // if (props.smbPassword !== undefined && !isNonEmptyString(props.smbPassword)) throw new Error('smbPassword must be a non-empty string if provided')
      // if (!props.password && !props.smbPassword) throw new Error('both password and smbPassword undefined')
      if (props.encrypted !== undefined && typeof props.encrypted !== 'boolean') throw new Error('encrypted must be either true or false')

      // TODO props validation should be in router, I guess
    } catch (e) {
      return process.nextTick(() => callback(e))
    }
    request
      .patch('http://127.0.0.1:3001/v1/user/password')
      .set('Accept', 'application/json')
      .send(props)
      .timeout(30 * 1000)
      .end((err, res) => {
        if (err) return callback(err)
        console.log('update', res.body)
        this.storeSave(users => {
          let index = users.findIndex(u => u.uuid === userUUID)
          if (index === -1) throw new Error('user not found')
          let nextUser = Object.assign({}, users[index])
          nextUser.password = res.body.password
          return [...users.slice(0, index), nextUser, ...users.slice(index + 1)]
        }, (err, data) => {
          if (err) return callback(err)
          return callback(null, data.find(x => x.uuid === userUUID))
        })
      })
  }

  bindFirstUser (boundUser) {
    this.storeSave(users => {
      let index = users.findIndex(u => u.isFirstUser)
      if (index === -1) {
        return [{
          uuid: UUID.v4(),
          username: boundUser.name || 'admin',
          isFirstUser: true,
          phicommUserId: boundUser.phicommUserId,
          password: boundUser.password,
          smbPassword: '',
          status: USER_STATUS.ACTIVE
        }]
      } else {
        let firstUser = Object.assign({}, users[index])
        // maybe undefined
        firstUser.password = boundUser.password
        if (firstUser.phicommUserId !== boundUser.phicommUserId) {
          console.log('===================')
          console.log('This is not an error, but fruitmix received a bound user')
          console.log('different than the previous one, exit')
          console.log('===================')
          process.exit(67)
        }
        if (isNonEmptyString(boundUser.phoneNumber) && firstUser.phoneNumber !== boundUser.phoneNumber) {
          if (users.find(u => u.phoneNumber === boundUser.phoneNumber && u.status !== USER_STATUS.DELETED)) {
            console.log('==============')
            console.log('update bound user phoneNumber already exist')
            console.log('update failed')
            console.log('==============')
          } else {
            console.log('==============')
            console.log('update bound user phoneNumber')
            console.log('==============')
            firstUser.phoneNumber = boundUser.phoneNumber
          }
        }
        return [
          ...users.slice(0, index),
          firstUser,
          ...users.slice(index + 1)
        ]
      }
    },
    err => err
      ? console.log(`user module failed to bind first user to ${boundUser.phicommUserId}`, err)
      : console.log(`user module bound first user to ${boundUser.phicommUserId} successfully`))
  }

  destroy (callback) {
    this.store.destroy(callback)
  }

  basicInfo (user) {
    return {
      uuid: user.uuid,
      username: user.username,
      isFirstUser: user.isFirstUser,
      phicommUserId: user.phicommUserId,
      phoneNumber: user.phoneNumber
    }
  }

  fullInfo (user) {
    return {
      uuid: user.uuid,
      username: user.username,
      isFirstUser: user.isFirstUser,
      phicommUserId: user.phicommUserId,
      password: !!user.password,
      smbPassword: !!user.smbPassword,
      createTime: user.createTime,
      status: user.status,
      phoneNumber: user.phoneNumber,
      reason: user.reason
    }
  }

  /**
  Implement LIST method
  */
  LIST (user, props, callback) {
    if (!user) {
      // basic info of all users
      return process.nextTick(() => callback(null, this.users.filter(u => u.status === USER_STATUS.ACTIVE).map(u => this.fullInfo(u))))
    } else if (user.isFirstUser) {
      // full info of all users
      return process.nextTick(() => callback(null, this.users.filter(u => u.status !== USER_STATUS.DELETED).map(u => this.fullInfo(u))))
    } else {
      // full info of the user
      return process.nextTick(() => {
        let u = this.users.find(u => u.uuid === user.uuid)
        if (!u) {
          let err = new Error('authenticated user not found in user resource')
          err.status = 500
          callback(err)
        } else {
          callback(null, [this.fullInfo(u)])
        }
      })
    }
  }

  /**
  Implement POST method

  wisnuc: the first user can be created by anonymous user
  phicomm: the first user cannot be created by api. It must be injected.
  */
  POST (user, props, callback) {
    if (!isNonNullObject(props)) return callback(Object.assign(new Error('props must be non-null object'), { status: 400 }))
    let recognized = ['username', 'phicommUserId', 'phoneNumber']
    Object.getOwnPropertyNames(props).forEach(key => {
      if (!recognized.includes(key)) throw Object.assign(new Error(`unrecognized prop name ${key}`), { status: 400 })
    })
    if (!isNonEmptyString(props.username)) return callback(Object.assign(new Error('username must be non-empty string'), { status: 400 }))
    if (!isNonEmptyString(props.phicommUserId)) return callback(Object.assign(new Error('phicommUserId must be non-empty string'), { status: 400 }))
    if (!isNonEmptyString(props.phoneNumber)) return callback(Object.assign(new Error('phoneNumber must be non-empty string'), { status: 400 }))
    if (props.password && !isNonEmptyString(props.password)) return callback(Object.assign(new Error('password must be non-empty string'), { status: 400 }))
    if (this.users.length && (!user || !user.isFirstUser)) return process.nextTick(() => callback(Object.assign(new Error('Permission Denied'), { status: 403 })))

    this.createUser(props, (err, user) => err ? callback(err) : callback(null, this.fullInfo(user)))
  }

  /**
  Implement GET method
  */
  GET (user, props, callback) {
    let userUUID = props.userUUID
    let u = isUUID(userUUID) ? this.getUser(props.userUUID) : this.users.find(u => u.phicommUserId === props.userUUID && u.status !== USER_STATUS.DELETED)
    if (!u) return process.nextTick(() => callback(Object.assign(new Error('user not found'), { status: 404 })))
    if (user.isFirstUser || user.uuid === u.uuid) return process.nextTick(() => callback(null, this.fullInfo(u)))
    return process.nextTick(Object.assign(new Error('Permission Denied'), { status: 403 }))
  }

  /**
  Implement PATCH
  */
  PATCH (user, props, callback) {
    let userUUID
    let devU = isUUID(props.userUUID) ? this.users.find(u => u.uuid === props.userUUID && u.status !== USER_STATUS.DELETED)
      : this.users.find(u => u.phicommUserId === props.userUUID && u.status !== USER_STATUS.DELETED)
    if (!devU) return callback(Object.assign(new Error('user not found'), { status: 404 }))
    userUUID = devU.uuid

    if (props.password) {
      let recognized = ['password', 'userUUID', 'encrypted']
      if (!Object.getOwnPropertyNames(props).every(k => recognized.includes(k))) {
        return process.nextTick(() => callback(Object.assign(new Error('too much props in body'), { status: 400 })))
      }
      if (user.uuid !== userUUID) return process.nextTick(() => callback(Object.assign(new Error('Permission Denied'), { status: 403 })))
      this.updatePassword(userUUID, props, (err, user) => err ? callback(err) : callback(null, this.fullInfo(user)))
    } else {
      let recognized = ['username', 'status', 'userUUID', 'phoneNumber', 'smbPassword']
      if (!Object.getOwnPropertyNames(props).every(k => recognized.includes(k))) {
        return process.nextTick(() => callback(Object.assign(new Error('too much props in body'), { status: 400 })))
      }

      if (props.username && !isNonEmptyString(props.username)) return callback(Object.assign(new Error('username must be non-empty string'), { status: 400 }))

      let u = this.users.find(u => u.username === props.username)
      if (u && u.status !== USER_STATUS.DELETED) return callback(Object.assign(new Error('username exist'), { status: 400 }))
      let recognizedStatus = [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.DELETED]

      if (props.status && !user.isFirstUser) return callback(Object.assign(new Error('Permission Denied'), { status: 403 }))
      if (props.status && user.uuid === userUUID) return callback(Object.assign(new Error('can not change admin status'), { status: 400 }))
      if (props.status && !recognizedStatus.includes(props.status)) return callback(Object.assign(new Error('unknown status'), { status: 400 }))

      if (!user.isFirstUser && user.uuid !== userUUID) return process.nextTick(() => callback(Object.assign(new Error('Permission Denied'), { status: 403 })))
      this.updateUser(userUUID, props, (err, data) => err ? callback(err) : callback(null, this.fullInfo(data)))
    }
  }

  DELETE (user, props, callback) {
    let userUUID
    let devU = isUUID(props.userUUID) ? this.users.find(u => u.uuid === props.userUUID && u.status !== USER_STATUS.DELETED)
      : this.users.find(u => u.phicommUserId === props.userUUID && u.status !== USER_STATUS.DELETED)
    if (!devU) return callback(Object.assign(new Error('user not found'), { status: 404 }))
    userUUID = devU.uuid

    if (!user.isFirstUser) return callback(Object.assign(new Error('Permission Denied'), { status: 403 }))
    this.updateUser(userUUID, { status: USER_STATUS.DELETED }, callback)
  }
}

User.prototype.USER_STATUS = USER_STATUS

module.exports = User
