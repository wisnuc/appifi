const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const UUID = require('uuid')

const DataStore = require('../lib/DataStore')

class Drive extends EventEmitter {

  /**
  Create a Drive

  @param {object} opts
  @param {string} opts.file - path of drives.json
  @param {string} opts.tmpDir - path of tmpDir (should be suffixed by 'drives')
  */
  constructor (opts, user) {
    super()
    this.conf = opts.configuration // is this required ??? TODO

    this.fruitmixDir = opts.fruitmixDir
    this.user = user

    this.user.on('Update', this.handleUserUpdate.bind(this))

    this.store = new DataStore({
      file: opts.file,
      tmpDir: opts.tmpDir,
      isArray: true
    })

    this.store.on('Update', (...args) => this.emit('Update', ...args))

    Object.defineProperty(this, 'users', {
      get () {
        return this.user.users || []
      }
    })

    // effective drive?
    Object.defineProperty(this, 'drives', {
      get () {
        return this.store.data
      }
    })

    Object.defineProperty(this, 'users', {
      get () {
        return this.user.users || []
      }
    })
  }

  handleVFSDeleted (driveUUID) {
    let drv = this.drives.find(drv => drv.uuid === driveUUID)
    if (!drv) return // ignore
    this.removeDrive(driveUUID, {}, err => {
      if (err) return // skip, unknown error when remove drive
      this.user.handleDriveDeleted(drv.owner)
    })
  }

  handleUserUpdate (users) {
    let deletedUsers = users.filter(u => u.status === this.user.USER_STATUS.DELETED).map(u => u.uuid)
    if (!deletedUsers.length) return
    this.store.save(drives => {
      deletedUsers.forEach(userUUID => {
        let drv = drives.find(drv => drv.owner === userUUID && drv.type === 'private')
        if (!drv) this.user.handleDriveDeleted(userUUID) // report user module
        else this.deleteDrive(drv.uuid, {}, () => {}) // update drive isDeleted
      })      
      return drives
    }, () => {})
  }

  /**
  This
  */
  retrieveDrives (userUUID, callback) {
    this.store.save(drives => {
      let priv = drives.find(drv => drv.type === 'private' && drv.owner === userUUID)
      let builtIn = drives.find(drv => drv.type === 'public' && drv.tag === 'built-in')

      if (priv && builtIn) {
        return drives
      } else {
        let newDrives = [...drives]
        if (!priv) {
          newDrives.push({
            uuid: UUID.v4(),
            type: 'private',
            owner: userUUID,
            tag: 'home',
            label: '',
            isDeleted: false
          })
        }

        if (!builtIn) {
          newDrives.push({
            uuid: UUID.v4(),
            type: 'public',
            writelist: '*',
            readlist: '*',
            label: '',
            tag: 'built-in'
          })
        }
        return newDrives
      }
    }, (err, drives) => {
      err ? callback(err)
        : callback(null, [
          ...drives.filter(drv => drv.type === 'private' && drv.owner === userUUID),
          ...drives.filter(drv => drv.type === 'public' && (drv.writelist === '*' || drv.writelist.includes(userUUID)))
        ])
    })
  }

  createPublicDrive (props, callback) {
    let drive = {
      uuid: UUID.v4(),
      type: 'public',
      writelist: props.writelist || [],
      readlist: props.readlist || [],
      label: props.label || ''
    }

    // TODO create directory

    this.store.save(drives => [...drives, drive],
      (err, drives) => err ? callback(err) : callback(null, drive))
  }

  getDrive (driveUUID) {
    return this.drives.find(d => d.uuid === driveUUID)
  }

  updateDrive (driveUUID, props, callback) {
    this.store.save(drives => {
      let index = drives.findIndex(drv => drv.uuid === driveUUID)
      if (index === -1) throw new Error('drive not found')
      let priv = Object.assign({}, drives[index])
      if (priv.type === 'private') {
        if (props.label) 
          if (drives.every(d => d.label !== props.label)) priv.label = props.label
          else throw new Error('label has already been used')
      } else {

        if (props.writelist)
          if (props.writelist === '*' || props.writelist.every(uuid => !!this.users.find(u => u.uuid === uuid))) priv.writelist = props.writelist
          else throw new Error('writelist not all user uuid found')
        if (props.readlist)
          if (props.readlist === '*' || props.readlist.every(uuid => !!this.users.find(u => u.uuid === uuid))) priv.readlist = props.readlist
          else throw new Error('readlist not all user uuid found')
        if (props.label) 
          if (drives.every(d => d.label !== props.label))priv.label = props.label
          else throw new Error('label has already been used')
      }
      return [...drives.slice(0, index), priv, ...drives.slice(index + 1)]
    }, (err, data) => err ? callback(err) : callback(null, data.find(d => d.uuid === driveUUID)))
  }

  deleteDrive (driveUUID, props, callback) {
    this.store.save(drives => {
      let index = drives.findIndex(drv => drv.uuid === driveUUID)
      if (index === -1) throw new Error('drive not found')
      let drv = Object.assign({}, drives[index])
      drv.isDeleted = true
      return [...drives.slice(0, index), drv, ...drives.slice(index + 1)]
    }, callback)
  }

  removeDrive (driveUUID, props, callback) {
    this.store.save(drives => {
      let index = drives.findIndex(drv => drv.uuid === driveUUID)
      if (index === -1) throw Object.assign(new Error('drive not found'), { code: 'ENOENT' })
      return [...drives.slice(0, index), ...drives.slice(index + 1)]
    }, callback)
  }

  /**
   * @argument userUUID - user uuid
   * @argument driveUUID - drive uuid
   */
  userCanReadDrive (userUUID, driveUUID) {
    let drv = this.getDrive(driveUUID)
    if (!drv) return false
    if (drv.type === 'private'　&& drv.owner === userUUID) return true
    if (drv.type === 'public' && (drv.writelist === '*' || drv.writelist.includes(userUUID))) return true
    return false
  }

  LIST (user, props, callback) {
    this.retrieveDrives(user.uuid, callback)
  }

  /**
   * 
   * @param {object} user 
   * @param {object} props 
   * @param {string} props.driveUUID
   * @param {function} callback 
   */
  GET (user, props, callback) {
    if (!this.userCanReadDrive(user.uuid, props.driveUUID)) 
      return process.nextTick(() => callback(Object.assign(new Error('Permission Denied'), { status: 403 })))
    let drv = this.getDrive(props.driveUUID)
    if (!drv) 
      return process.nextTick(() => callback(Object.assign(new Error('drive not found'), { status: 403 })))
    process.nextTick(() => callback(null, drv))
  }

  /**
   * @param {object} user 
   * @param {object} props 
   * @param {array} props.writelist
   * @param {array} props.readlist
   * @param {string} props.label
   * @param {Function} callback 
   */
  POST (user, props, callback) {
    if (!user.isFirstUser) return callback(Object.assign(new Error(`requires admin priviledge`), { status: 403 }))
    this.createPublicDrive(props, callback)
  }

  PATCH (user, props, callback) {
    let driveUUID = props.driveUUID
    delete props.driveUUID
    try {
      if (!user.isFirstUser) {
        throw Object.assign(new Error(`requires admin priviledge`), { status: 403 })
      }
      let drive = this.drives.find(drv => drv.uuid === driveUUID)
      if (!drive) {
        throw Object.assign(new Error(`drive ${driveUUID} not found`), { status: 404 })
      }
      if (drive.type === 'private' || (drive.type === 'public' && drive.tag === 'built-in')) {
        // only allow update label
        if (!Object.getOwnPropertyNames(props).every(name => name === 'label')) {
          let err = new Error('Only label is allowed to update for private drive')
          err.code = 'EBADREQUEST'
          err.status = 400
          throw err
        }
      } else {
        // public drive other than built-in one 
        let recognized = ['uuid', 'type', 'writelist', 'readlist', 'label']
        Object.getOwnPropertyNames(props).forEach(name => {
          if (!recognized.includes(name)) {
            throw Object.assign(new Error(`unrecognized prop name ${name}`), { status: 400 })
          }
        })

        let disallowed = ['uuid', 'type', 'readlist']
        Object.getOwnPropertyNames(props).forEach(name => {
          if (disallowed.includes(name)) {
            throw Object.assign(new Error(`${name} is not allowed to update`), { status: 403 })
          }
        })
      }

      // validate writelist, readlist
      Object.keys(props).forEach(key => {
        if (key !== 'writelist' && key !== 'readlist') return
        let list = props[key]
        if (list === '*') return
        if (!Array.isArray(list)) {
          let err = new Error(`${key} must be either wildcard or an uuid array`)
          err.code = 'EBADREQUEST'
          err.status = 400
          throw err
        }
        if (!list.every(uuid => !!this.users.find(u => u.uuid === uuid))) {
          let err = new Error(`${key} not all user uuid found`) // TODO
          err.code = 'EBADREQUEST'
          err.status = 400
          throw err
        }
        props[key] = Array.from(new Set(list)).sort()
      })
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    this.updateDrive(driveUUID, props, callback)
  }

}

module.exports = Drive
