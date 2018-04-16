const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const bcrypt = require('bcrypt')
const deepFreeze = require('deep-freeze')

const { isUUID, isNonNullObject, isNonEmptyString } = require('../lib/assertion')
const DataStore = require('../lib/DataStore')

/**
Using composition instead of inheritance.
*/
class User extends EventEmitter {

  /**
  Create a User 
  */  
  constructor(opts) {
    super()

    this.store = new DataStore({
      file: opts.file,
      tmpDir: opts.tmpDir,
      isArray: true
    }) 

    this.store.on('Update', (...args) => this.emit('Update', ...args))

    Object.defineProperty(this, 'users', {
      get () {
        return this.store.data
      }
    })
  }

  getUser (userUUID) {
    return this.users.find(u => uuid === userUUID)
  }

  createUser (props, callback) {
    this.store.save(users => {
    }, callback)
  }

  updateUser (userUUID, props, callback) {
    this.store.save(users => {
      let index = users.findIndex(u => u.uuid === userUUID)
      if (index === -1) throw new Error('user not found')
      let nextUser = Object.assign({}, users[index], props)
      return [...users.slice(0, index), nextUser, ...users.slice(index + 1)]
    }, callback)
  }

  deleteUser (userUUID, callback) {
    this.store.save(data => {
      let index = users.findIndex(u => u.uuid === userUUID)
      if (index === -1) throw new Error('user not found')
      return [...users.slice(0, index), ...users.slice(index + 1)]
    }, callback)
  }


  /** 

  @param {object} props
  @param {string} props.password - password 
  @param {string} props.smbPassword - smb password
  @param {boolean} [props.encrypted] - if true, both passwords are considered to be encrypted
  */
  updatePassword (userUUID, props, callback) {
    try {
      if (!isUUID(userUUID)) throw new Error(`userUUID ${userUUID} is not a valid uuid`)
      if (!isNonNullObject(props)) throw new Error('props is not a non-null object')
      if (props.password !== undefined && !isNonEmptyString(props.password)) 
        throw new Error('password must be a non-empty string if provided') 
      if (props.smbPassworld !== undefined && !isNonEmptyString(props.smbPassword))
        throw new Error('smbPassword must be a non-empty string if provided')
      if (!props.password && !props.smbPassword) throw new Error('both password and smbPassword undefined')
      if (props.encrypted !== undefined && typeof props.encrypted !== 'boolean')
        throw new Error('encrypted must be either true or false')

      // TODO props validation should be in router, I guess

    } catch (e) {
      return process.nextTick(callback(e))
    }
    // props.encrypted = !!props.encrypted

    let { password, smbPassword, encrypted } = props

    this.store.save(users => {
      let index = users.findIndex(u => u.uuid === userUUID) 
      if (index === -1) throw new Error('user not found')  
      let nextUser = Object.assign({}, users[index])
      if (password) nextUser.password = encrypted ? password : passwordEncrypt(password, 10)
      if (smbPassword) nextUser.smbPassword = encrypted ? smbPassword : md4Encrypt(smbPassword)
      return [...users.slice(0, index), nextUser, ...users.slice(index + 1)]
    }, callback)
  }

  destory (callback) {
    this.store.destroy(callback)
  }
}

module.exports = User
