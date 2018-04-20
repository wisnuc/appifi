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
      return [
        ...drives.filter(drv => drv.type === 'private' && drv.owner === userUUID),
        ...drives.filter(drv => drv.type === 'public' && drv.writelist.includes(userUUID))
      ]
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

}
