const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const DataStore = require('../lib/DataStore')

class Drive extends EventEmitter {

  /**
  Create a Drive

  @param {object} opts
  @param {string} opts.file - path of drives.json
  @param {string} opts.tmpDir - path of tmpDir (should be suffixed by 'drives')
  */
  constructor(opts, user) {
    super()
    this.conf = opts.configuration // is this required ??? TODO

    this.fruitmixDir = opts.fruitmixDir

    this.store = new DataStore({
      file: opts.file,
      tmpDir: opts.tmpDir,
      isArray: true
    })

    this.store.on('Update', (...args) => this.emit('Update', ...args))

    // effective drive?
    Object.defineProperty(this, 'drives', {
      get () {
        return this.store.data
      }
    })
  }

  /**
  This 
  */
  retrieveDrives (userUUID, callback) {
    this.store.save(drives => {
      let priv = drives.find(drv => drv.type === 'private' && drv.owner === userUUID)
      if (priv) {
        return drives
      } else {
        let drive = {
          uuid: UUID.v4(),
          type: 'private',
          owner: userUUID,
          tag: 'home'
        }
        return [...drives, drive]
      }
    }, (err, drives) => {
      err ? callback(err) :
        callback(null, [
          ...drives.filter(drv => drv.type === 'private' && drv.owner === userUUID),
          ...drives.filter(drv => drv.type === 'public' && (drv.writelist === '*' ||drv.writelist.includes(userUUID)))
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

  getDrive (driveUUID, callback) {
    return this.drives.find(d => d.uuid === driveUUID)
  }

  updateDrive (driveUUID, props, callback) {
    this.store.save(drives => {
      let index = drives.findIndex(drv => drv.uuid === driveUUID)
      if (index === -1) throw new Error('drive not found')
      let priv = Object.assign({}, drives[index])
      if (priv.type === 'private') {
        // TODO: do nothing?
        return drives
      }

      if (props.writelist) priv.writelist = props.writelist
      if (props.readlist) priv.readlist = props.readlist
      if (props.label) priv.label = props.label
      //TODO: can change type ?

      return [...drives.slice(0, index), priv, ...drives.slice(index + 1)]
    }, (err, data) => err ? callback(err) : callback(null, data.find(d => d.uuid === driveUUID)))
  }

  deleteDrive (driveUUID, props, callback) {

  }

  userCanReadDrive (userUUID, driveUUID) {

  }

  LIST (user, props, callback) {
    this.retrieveDrives(user.uuid, callback)
  }

  GET (user, props, callback) {
    if (!this.userCanReadDrive(user.uuid, props.driveUUID))
      return process.nextTick(() => callback(Object.assign(new Error('Permission Denied'), { status: 403 })))
    this.getDrive(props.driveUUID, callback)
  }

  POST (user, props, callback) {
    if (!user.isFirstUser) return callback(null, Object.assign(new Error(`requires admin priviledge`), { status: 403 }))
    this.createPublicDrive(props, callback)
  }

  PATCH (user, props, callback) {
    try {
      if (!user.isAdmin) {
        throw Object.assign(new Error(`requires admin priviledge`), { status: 403 })
      }
      let drive = this.drives.find(drv => drv.uuid === props.driveUUID)
      if (!drive) {
        throw Object.assign(new Error(`drive ${driveUUID} not found`), { status: 404 })
      }
      if (drive.type === 'pirvate') {
        // private drive is not allowed to update
        throw Object.assign(new Error(`private drive is not allowed to update`), { status: 403 })
      } else if (drive.type === 'public' && drive.tag === 'built-in') {
        // built-in public drive, only label can be updated
        if (!Object.getOwnPropertyNames(props).every(name => name === 'label')) {
          let err = new Error('Only label is allowed to update for built-in public drive')     
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
      if (props.writelist) {
        let wl = props.writelist
        if (wl === '*') {
        } else if (Array.isArray(wl)) {
          if (!wl.every(uuid => !!this.userList.users.find(u => u.uuid === uuid))) {
            let err = new Error(`not all user uuid found`) // TODO
            err.code = 'EBADREQUEST'
            err.status = 400
            throw err
          }
          props.writelist = Array.from(new Set(props.writelist)).sort()
        } else {
          let err = new Error('writelist must be either wildcard or an uuid array')
          err.code = 'EBADREQUEST'
          err.status = 400
          throw err
        }
      }
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    this.updateDrive(props.driveUUID, props, callback)
  }

}

module.exports = Drive