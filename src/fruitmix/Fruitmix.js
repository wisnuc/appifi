const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const crypto = require('crypto')

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const UUID = require('uuid')

const User = require('./User')
const MediaMap = require('../media/persistent')
const Thumbnail = require('../lib/thumbnail2')
const VFS = require('../vfs/vfs')
const Tag = require('../tags/Tag')

/**
Fruitmix has the following structure:

```
{
  user,
  drive,
  tag,

  xstat,
  mediaMap,
  forest,
  vfs, 

  xcopy,
  search, 

  transmission,
  samba,
  dlna,

  apis: {
    user,
    drive,
    ...
  }
}
```

1. we define a set of standard api methods.
2. developer can write a separate api module, or just implements those apis on the resource model module.

For example: user module provides apis. so fruitmix.user and fruitmix.apis.user are the same instance.

but for directories and files api, it is obviously that the separate api module should be created. Both depends on VFS module.





Fruitmix has no knowledge of chassis, storage, etc.
*/
class Fruitmix2 extends EventEmitter {

  /**
  @param {object} opts
  @param {string} opts.fruitmixDir - absolute path
  @param {boolean} opts.enableSmb - use samba module
  @param {boolean} opts.enableDlna - use dlna module
  @param {boolean} opts.enableTransmission - use transmission module
  */
  constructor (opts) {
    super()
    this.fruitmixDir = opts.fruitmixDir
    mkdirp.sync(this.fruitmixDir)
    
    this.tmpDir = path.join(this.fruitmixDir, 'tmp')
    rimraf.sync(this.tmpDir)
    mkdirp.sync(this.tmpDir)

    // setup user module
    this.user = new User({
      file: path.join(this.fruitmixDir, 'users.json'),
      tmpDir: path.join(this.fruitmixDir, 'tmp', 'users'),
      isArray: true
    })

    // set a getter method for this.users
    Object.defineProperty(this, 'users', {
      get () {
        return this.user.users || [] // TODO can this be undefined?
      }
    })

    this.tag = new Tag({
      file: path.join(this.fruitmixDir, 'tags.json'),
      tmpDir: path.join(this.fruitmixDir, 'tmp', 'tags'),
      isArray: false
    })

    let metaPath = path.join(this.fruitmixDir, 'metadataDB.json')
    this.mediaMap = new MediaMap(metaPath, this.tmpDir)
    this.vfs = new VFS(this.fruitmixDir, this.mediaMap)

    this.thumbnail = new Thumbnail(path.join(this.fruitmixDir, 'thumbnail'), this.tmpDir)

    this.user.on('Update', () => {
      this.emit('FruitmixStarted')
    })
  }

  init (opts) {
    this.emit('initialized')
  }


  /**
  
  */
  getUsers () {
    return this.users.map(u => ({
      uuid: u.uuid,
      username: u.username,
      isFirstUser: u.isFirstUser,
      phicommUserId: u.phicommUserId,
      password: !!u.password,
      smbPassword: !!u.smbPassword
    }))
  }

  /**
  This function returns a list of users with minimal attributes.
  */
  displayUsers () {
    return this.users.map(u => ({
      uuid: u.uuid,
      username: u.username,
      isFirstUser: u.isFirstUser,
      phicommUserId: u.phicommUserId 
    }))
  }   

}

module.exports = Fruitmix2
