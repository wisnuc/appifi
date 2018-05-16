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

const Magic = require('./lib/magic')
const UserList = require('./user/user')
const DocStore = require('./box/docStore')
const BlobStore = require('./box/BlobStore')
const BoxData = require('./box/Boxes')
const DriveList = require('./vfs/vfs')
const Thumbnail = require('./lib/thumbnail2')
const File = require('./vfs/file')
const createTag = require('./tags/tags')

const Identifier = require('./lib/identifier')
const { btrfsConcat, btrfsClone } = require('./lib/btrfs')
const jwt = require('jwt-simple')
const secret = require('./config/passportJwt')

const extract = require('./lib/metadata')

const MediaMap = require('./media/persistent')

const { assert, isUUID, isSHA256, validateProps } = require('./common/assertion')

const CopyTask = require('./tasks/fruitcopy')
const MoveTask = require('./tasks/fruitmove')

const xcopy = require('./tasks/xcopy')
const xcopyAsync = Promise.promisify(xcopy)

const { readXstat, forceXstat } = require('./lib/xstat')
const SambaServer = require('./samba/samba')
const SambaServer2 = require('./samba/smbState')
const DlnaServer = require('./samba/dlna')

const Debug = require('debug')
const smbDebug = Debug('samba')
const debug = Debug('fruitmix')

const mixin = require('./fruitmix/mixin')
const driveapi = require('./fruitmix/drive')
const ndriveapi = require('./fruitmix/ndrive')
const boxapi = require('./fruitmix/box')
const tagapi = require('./fruitmix/tag')

const combineHash = (a, b) => {
  let a1 = typeof a === 'string' ? Buffer.from(a, 'hex') : a
  let b1 = typeof b === 'string' ? Buffer.from(b, 'hex') : b
  let hash = crypto.createHash('sha256')
  hash.update(Buffer.concat([a1, b1]))
  let digest = hash.digest('hex')
  return digest
}

const statusError = (err, status) => Object.assign(err, { status })

const Throw = (err, code, status) => {
  err.code = code
  err.status = status
  throw err
}

const nosmb = !!process.argv.find(arg => arg === '--disable-smb') || process.env.NODE_PATH !== undefined

const noBox = !!process.argv.find(arg => arg === '--disable-box') || process.env.NODE_PATH !== undefined

/**
Fruitmix is the facade of internal modules, including user, drive, forest, and box.

Fruitmix is responsible for authorization, but not authentication.

Station module and all routers consumes only Fruitmix API. They are NOT allowed to
bypass the facade to access the internal modules.

Fruitmix is also responsible for initialize all internal modules and paths.

@extends EventEmitter
@mixes mixin
@mixes driveapi
*/
class Fruitmix extends EventEmitter {

  /**
  @params {string} froot - fruitmix root path, should be an normalized absolute path
  */
  constructor (froot, opt) {
    super()
    let thumbDir = path.join(froot, 'thumbnail')
    let tmpDir = path.join(froot, 'tmp')
    rimraf.sync(tmpDir)
    mkdirp.sync(tmpDir)

    this.fruitmixPath = froot

    let metaPath = path.join(froot, 'metadataDB.json')
    
    this.tags = createTag(froot)

    // this is acturally a PersistentMediaMap
    this.mediaMap = new MediaMap(metaPath, tmpDir)

    this.thumbnail = new Thumbnail(thumbDir, tmpDir)
    this.userList = new UserList(froot)
    this.driveList = new DriveList(froot, this.mediaMap)
    this.vfs = this.driveList
    this.tasks = []

    if (!nosmb) {
      // this.smbServer = new SambaServer(froot)
      this.smbServer = new SambaServer2(froot)
      this.smbServer.on('SambaServerNewAudit', audit => {
        this.driveList.audit(audit.abspath, audit.arg0, audit.arg1)
      })
      this.smbServer.start(this.userList.users, this.driveList.drives)
    }
    this.dlnaServer = new DlnaServer(froot)
    this.dlnaServer.startAsync(this.getBuiltInDrivePath())
      .then(() => {})
      .catch(console.error.bind(console,'dlna start error'))
    
    if (!noBox) this.boxData = new BoxData(this)
    
  }

  async startSambaAsync(user) {
    if(!this.smbServer) {
      this.smbServer = new SambaServer(this.fruitmixPath)
      this.smbServer.on('SambaServerNewAudit', audit => {
        this.driveList.audit(audit.abspath, audit.arg0, audit.arg1)
      })
    }
    await this.smbServer.startAsync(this.userList.users, this.driveList.drives)
  }

  async stopSambaAsync(user) {
    if(!this.smbServer) return
    this.smbServer.stopAsync()
  }

  async restartSambaAsync(user) {
    if(!this.smbServer) throw Object.assign(new Error('samba not start'), { status: 400 })
    await this.smbServer.restartAsync()
  }

  getSambaStatus(user) {
    if(!this.smbServer) return 'inactive'
    return this.smbServer.isActive() ? 'active' : 'inactive'
  }

  updateSamba() {
    if (nosmb) return
    this.smbServer.updateAsync(this.userList.users, this.driveList.drives)
      .then(() => {})
      .catch(e => console.error.bind(console, 'smbServer update error:'))
  }

  async startDlnaAsync(user) {
    if(!this.dlnaServer) this.dlnaServer = new DlnaServer(this.fruitmixPath)
    await this.dlnaServer.startAsync(this.getBuiltInDrivePath(user))
  }

  async stopDlnaAsync(user) {
    if(!this.dlnaServer) return
    await this.dlnaServer.stopAsync()
  }

  async restartDlnaAsync(user) {
    if(!this.dlnaServer) throw Object.assign(new Error('dlna not start'), { status: 400 })
    await this.dlnaServer.restartAsync()
  }

  getDlnaStatus(user) {
    if(!this.dlnaServer) return 'inactive'
    return this.dlnaServer.isActive() ? 'active' : 'inactive'
  }

  loadMediaMap (fpath) {
    let medias, data
    try {
      medias = fs.readFileSync(fpath, { encoding: 'utf8' }).split('\n').filter(x => !!x.length)
    } catch (e) {
      rimraf.sync(fpath) // remove
      medias = []
    }
    let mediaMap = new Map()
    medias.forEach(x => {
      try {
        data = JSON.parse(x)
        if (data.length === 2) {
          mediaMap.set(data[0], data[1])
        }
      } catch (e) { } // TODO:
    })
    return mediaMap
  }

  getUserByUUID (userUUID) {
    let user = this.userList.users.find(u => u.uuid === userUUID)
    if (user) {
      return {
        uuid: user.uuid,
        username: user.username,
        isFirstUser: user.isFirstUser,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        global: user.global,
        disabled: user.disabled
      }
    }
  }

  /**
   
  */
  hasUsers () {
    return this.userList.users.length !== 0
  }

  /**
  This function returns a list of users with minimal attributes.
  */
  displayUsers () {
    return this.userList.users.map(u => ({
      uuid: u.uuid,
      username: u.username,
      avatar: u.avatar,
      disabled: u.disabled
    }))
  }

  getUsers () {
    return this.userList.users.map(u => ({
      uuid: u.uuid,
      username: u.username,
      isFirstUser: u.isFirstUser,
      isAdmin: u.isAdmin,
      avatar: u.avatar,
      global: u.global,
      disabled: u.disabled
    }))
  }

  getToken (user) {
    return {
      type: 'JWT',
      token: jwt.encode({ uuid: user.uuid }, secret)
    }
  }

  /**
  {
    uuid:         // not allowed to change
    username:     // allowed
    password:     // allowed
    isFirstUser:  // not allowed to change
    isAdmin:      // allowed
    avatar:       // not allowed to change
    global:       // allowed
    disabled:     // allowed
  }

  If  userUUID is itself (superuser, admin, common user)
    allowed: username, global, password, 
  If user is super user, userUUID is not itself
    allowed: isAdmin, username, password, global, disabled
  if user is admin 
    allowed: username, password, global, disabled
  if user is common user
    only can change itself
  */ 
  userCanUpdate (user, userUUID, props) {
    let u = this.findUserByUUID(userUUID) // is operated
    if (!user || !userUUID) throw Object.assign(new Error('user not found'), { status: 404 })
    if (props === undefined || (Array.isArray(props) && props.length === 0)) return true
    // 'uuid', 'isFirstUser', 'avatar' can not be change
    let recognized = [
      'username', 'password', 'isAdmin', 'global', 'disabled'
    ]

    Object.getOwnPropertyNames(props).forEach(name => {
      if (!recognized.includes(name)) {
        throw Object.assign(new Error(`unrecognized prop name ${name}`), { status: 400 })
      }
    })

    let disallowed

    if (user.uuid === userUUID) {
      disallowed = [ 'isAdmin', 'disabled' ]
    } else {
      if (user.isFirstUser) return true
      else if (user.isAdmin) {
        if (u.isAdmin) return false // admin and isFirstUser
        disallowed = ['isAdmin']
      } else return false // common user
    }

    Object.getOwnPropertyNames(props).forEach(name => {
      if (disallowed.includes(name)) {
        throw Object.assign(new Error(`unrecognized prop name ${name}`), { status: 403 })
      }
    })
    return true
  }

  /**
   * 1 own drives
   * 2 public drive (writelist or readlist)
   * @param {*} user 
   * @param {*} dirUUID 
   */
  userCanRead (user, dirUUID) {
    if (!user || !dirUUID || !dirUUID.length) throw Object.assign(new Error('Invalid parameters'), { status: 400 })
    if (!this.driveList.uuidMap.has(dirUUID)) { throw Object.assign(new Error('drive not found'), { status: 404 }) }
    let drive = this.driveList.uuidMap.get(dirUUID)
    let rootDrive = drive.root()
    let userDrives = this.getDrives(user)
    if (userDrives.findIndex(d => d.uuid === rootDrive.uuid) !== -1) return true
    return false
  }

  // write maybe upload, (remove??)
  // 1 own drives
  // 2 public drive && (writelist or (readlist&& admin))
  userCanWrite (user, dirUUID) {
    if (!user || !dirUUID || !dirUUID.length) throw Object.assign(new Error('Invalid parameters'), { status: 400 })
    if (!this.driveList.uuidMap.has(dirUUID)) { throw Object.assign(new Error('drive not found'), { status: 404 }) }
    let drive = this.driveList.uuidMap.get(dirUUID)
    let rootDrive = drive.root()

    let userDrives = this.driveList.drives.filter(drv => {
      if (drv.type === 'private' && drv.owner === user.uuid) return true
      if (drv.type === 'public' && (drv.writelist === '*' || ((drv.writelist.includes(user.uuid)) ||
        (drv.readlist.includes(user.uuid) && user.isAdmin)))) return true
      return false
    })

    if (userDrives.findIndex(d => d.uuid === rootDrive.uuid) !== -1) return true
    return false
  }

  //
  // This is an synchronous function
  //
  assertUserCanReadMedia (user, fingerprint) {
    if (!user || !isSHA256(fingerprint)) 
      Throw(new Error('invalid parameters'), 'EINVAL', 400)

    let meta = this.mediaMap.get(fingerprint)
    if (!meta) Throw (new Error('media not found'), null, 404)

    if (!meta.files.find(f => this.userCanRead(user, f.root().uuid)))
      Throw(new Error('permission denied'), 'EPERM', 403)

    return true

/**
    if (!this.driveList.metaMap.has(fingerprint)) { 
      throw Object.assign(new Error('media not found'), { status: 404 }) 
    }
**/

/**
    let meta = this.mediaMap.get(fingerprint)
    if (!meta) throw statusError(new Error('media not found'), 404)
    
    if (meta.files.find(f => this.userCanRead(user, f.root().uuid)) 
**/
/**
    let medias = Array.from(this.driveList.metaMap.get(fingerprint))
    let userDrives = this.getDrives(user).map(d => d.uuid)
    if (medias.find(media => userDrives.indexOf(media.root().uuid) !== -1)) { return true }
    return false
**/
    // return true
  }

  /**
   * if no user: create first user 
   * if first user : recognized -> ['isAdmin', 'username', 'password',  'global', 'disabled']
   * if admin : recognized -> [ 'username', 'password', 'global', 'disabled']
   * if common user return 403
  */
  async createUserAsync (user, props) {
    if (!user && this.hasUsers()) throw Object.assign(new Error('user not found'), { status: 400 })
    if (user && !user.isAdmin) throw Object.assign(new Error('permission denied'), { status: 403 })
    let recognized = ['username', 'password', 'global', 'disabled']
    if (!user || user.isFirstUser) {
      recognized.push('isAdmin') // super user
      let index = recognized.indexOf('disabled')
      recognized = [...recognized.slice(0, index), ...recognized.slice(index + 1)]
    }
    Object.getOwnPropertyNames(props).forEach(name => {
      if (!recognized.includes(name)) {
        throw Object.assign(new Error(`unrecognized prop name ${name}`), { status: 400 })
      }
    })

    let u = await this.userList.createUserAsync(props)
    await this.driveList.createPrivateDriveAsync(u.uuid, 'home')
    this.updateSamba()
    return u
  }

  /**
  */
  userUpdatePassword () {
    this.User.updatePassword()
  }

  verifyUserPassword (userUUID, password, done) {
    this.userList.verifyPassword(userUUID, password, done)
  }

  findUserByUUID (userUUID) {
    return this.userList.findUser(userUUID)
  }

  findUserByGUID (guid) {
    let user = this.userList.users.find(u => u.global && u.global.id === guid)
    return user
  }

  /**
  isFirstUser never allowed to change.
  possibly allowed props: username, isAdmin, global
  
  {
    uuid:         // not allowed to change
    username:     // allowed
    password:     // allowed
    isFirstUser:  // not allowed to change
    isAdmin:      // allowed
    avatar:       // not allowed to change
    global:       // allowed
  }
  
  If user is super user, userUUID is itself
    allowed: username, global
  If user is super user, userUUID is not itself
    allowed: isAdmin, 
  */ 
  async updateUserAsync (user, userUUID, body) {
    if (!this.userCanUpdate(user, userUUID, body)) { throw Object.assign(new Error(`unrecognized prop name `), { status: 400 }) }
    if (Object.getOwnPropertyNames(body).includes('password')) { throw Object.assign(new Error(`password is not allowed to change`), { status: 403 }) }
    let u = this.userList.updateUserAsync(userUUID, body)
    this.updateSamba()
    return u
  }

  async updateUserPasswordAsync (user, userUUID, body) {
    if (!user || user.uuid !== userUUID) throw Object.assign(new Error('user or uuid error'), { status: 400 })

    if (typeof body.password !== 'string') {
      throw Object.assign(new Error('bad format'), { status: 400 })
    }

    await this.userList.updatePasswordAsync(user.uuid, body.password)
    this.updateSamba()
  }

  async updateUserGlobalAsync (user, userUUID, body) {
    if (!body.global || typeof body.global !== 'object') { throw Object.assign(new Error('global format error'), { status: 400 }) }

    if (!body.global.id || typeof body.global.id !== 'string') { throw Object.assign(new Error('global.id format error'), { status: 400 }) }

    if (!body.global.wx || !(body.global.wx instanceof Array) || !body.global.wx.length) { throw Object.assign(new Error('global.wx format error'), { status: 400 }) }

    let props = Object.assign({}, { global: body.global })
    return this.userList.updateUserAsync(userUUID, props)
  }

  async getMediaBlacklistAsync (user) {
    let dirPath = path.join(this.fruitmixPath, 'users', user.uuid)
    await mkdirpAsync(dirPath)
    try {
      let filePath = path.join(this.fruitmixPath, 'users', user.uuid, 'media-blacklist.json')
      let list = JSON.parse(await fs.readFileAsync(filePath))
      return list
    } catch (e) {
      if (e.code === 'ENOENT' || e instanceof SyntaxError) return []
      throw e
    }
  }

  async setMediaBlacklistAsync (user, props) {
    // TODO must all be sha256 value

    if (!Array.isArray(props) || !props.every(x => isSHA256(x))) {
      throw Object.assign(new Error('invalid parameters'),
        { status: 400 })
    }

    let dirPath = path.join(this.fruitmixPath, 'users', user.uuid)
    await mkdirpAsync(dirPath)
    let filePath = path.join(this.fruitmixPath, 'users', user.uuid, 'media-blacklist.json')
    await fs.writeFileAsync(filePath, JSON.stringify(props))
  }

  async addMediaBlacklistAsync (user, props) {
    if (!Array.isArray(props) || !props.every(x => isSHA256(x))) {
      throw Object.assign(new Error('invalid parameters'),
        { status: 400 })
    }

    let dirPath = path.join(this.fruitmixPath, 'users', user.uuid)
    await mkdirpAsync(dirPath)

    let filePath, list
    try {
      filePath = path.join(this.fruitmixPath, 'users', user.uuid, 'media-blacklist.json')
      list = JSON.parse(await fs.readFileAsync(filePath))
    } catch (e) {
      if (e.code === 'ENOENT' || e instanceof SyntaxError) {
        list = []
      } else {
        throw e
      }
    }

    let merged = Array.from(new Set([...list, ...props]))
    await fs.writeFileAsync(filePath, JSON.stringify(merged))
    return merged
  }

  async subtractMediaBlacklistAsync (user, props) {
    if (!Array.isArray(props) || !props.every(x => isSHA256(x))) {
      throw Object.assign(new Error('invalid parameters'),
        { status: 400 })
    }

    let dirPath = path.join(this.fruitmixPath, 'users', user.uuid)
    await mkdirpAsync(dirPath)

    let filePath, list
    try {
      filePath = path.join(this.fruitmixPath, 'users', user.uuid, 'media-blacklist.json')
      list = JSON.parse(await fs.readFileAsync(filePath))
    } catch (e) {
      if (e.code === 'ENOENT' || e instanceof SyntaxError) {
        list = []
      } else {
        throw e
      }
    }

    let set = new Set(props)
    let subtracted = list.filter(x => !set.has(x))
    await fs.writeFileAsync(filePath, JSON.stringify(subtracted))
    return subtracted
  }

  getDrives (user) {
    let drives = this.driveList.drives.filter(drv => {
      if (drv.type === 'private' && drv.owner === user.uuid) return true
      if (drv.type === 'public' &&
        (drv.writelist === '*' || (drv.writelist.includes(user.uuid) || drv.readlist.includes(user.uuid)))) {
        return true
      }
      return false
    })

    return drives
  }

  /**
  Drive Metadata is the Drive Object
  Drive Data is the files and directories inside the Drive
  */

  // internal
  userCanReadDriveMetadata (user, drive) {
    if (drive.type === 'private' && drive.owner === user.uuid) return true
    if (drive.type === 'public') {
      if (user.isAdmin) return true
      if (drive.writelist === '*') return true
      if (Array.isArray(drive.writelist) && drive.writelist.includes(user.uuid)) return true
      if (drive.readlist === '*') return true
      if (Array.isArray(drive.readlist) && drive.readlist.includes(user.uuid)) return true
    } 
    return false
  }

  // internal
  userCanWriteDriveMetadata (user, drive) {
    if (drive.type === 'private' && drive.owner === user.uuid) return true
    if (drive.type === 'public' && user.isAdmin) return true
    return false
  }

  // internal
  userCanReadDriveData (user, drive) {
    if (drive.type === 'private' && drive.owner === user.uuid) return true
    if (drive.type === 'public') {
      if (drive.writelist === '*') return true
      if (Array.isArray(drive.writelist) && drive.writelist.includes(user.uuid)) return true
      if (drive.readlist === '*') return true
      if (Array.isArray(drive.readlist) && drive.readlist.includes(user.uuid)) return true
    }
    return false
  }

  // internal
  userCanWriteDriveData (user, drive) {
    if (drive.type === 'private' && drive.owner === user.uuid) return true
    if (drive.type === 'public') {
      if (drive.writelist === '*') return true
      if (Array.isArray(drive.writelist) && drive.writelist.includes(user.uuid)) return true
    }
    return false
  }

  /**
  TODO this function is used by pipe
  */
  getDriveList (user) {
    let drives = this.driveList.drives.filter(drv => {
      if (drv.type === 'private' && drv.owner === user.uuid) return true
      if (drv.type === 'public') {
        if (user.isAdmin) return true
        if (drv.writelist === '*') return true
        if (Array.isArray(drv.writelist) && drv.writelist.includes(user.uuid)) return true
        if (drv.readlist === '*') return true
        if (Array.isArray(drv.readlist) && drv.readlist.includes(user.uuid)) return true
      }
      return false
    })
    return drives
  }

  /**
  API: DriveList [POST]
  */
  async createPublicDriveAsync (user, props) {
    if (!user) throw Object.assign(new Error('Invaild user'), { status: 400 })
    if (!user.isAdmin) throw Object.assign(new Error(`requires admin priviledge`), { status: 403 })
    let d = this.driveList.createPublicDriveAsync(props)
    this.updateSamba()
    return d
  }

  /**
  TODO
  */
  getDrive (user, driveUUID) {
    if (!this.userCanRead(user, driveUUID)) throw Object.assign(new Error('permission denied'), { status: 403 })

    let drive = this.driveList.drives.find(drv => drv.uuid === driveUUID)
    if (!drive) { throw Object.assign(new Error(`drive ${driveUUID} not found`), { status: 404 }) }

    return drive
  }

  /**
  API: Drive [GET]
  callback version of Drive GET
  @param {object} user
  @param {string} driveUUID
  @param {function} callback - `(err, drive) => {}`
  @memberof api
  */
  getDrive2 (user, driveUUID, callback) {
    let drive = this.driveList.drives.find(drv => drv.uuid === driveUUID)
    if (!drive || !this.userCanReadDriveMetadata(user, drive)) {
      let err = new Error(`drive ${driveUUID} not found`)
      err.code = 'ENOTFOUND'
      err.status = 404
      process.nextTick(() => callback(err))
    } else {
      process.nextTick(() => callback(null, drive))
    } 
  }

  getBuiltInDrivePath (user) {
    let d = this.driveList.drives.find(drv => drv.tag === 'built-in' && drv.type === 'public')
    if(!d) throw Object.assign(new Error(`built-in drive not found`), { status: 404 })
    return path.join(this.fruitmixPath, 'drives', d.uuid)
  }

  /**
  uuid, type, writelist, readlist, label 
  */
  async updatePublicDriveAsync (user, driveUUID, props) {
    
    if (!user.isAdmin) {
      throw Object.assign(new Error(`requires admin priviledge`), { status: 403 })
    }

    let drive = this.driveList.drives.find(drv => drv.uuid === driveUUID)
    if (!drive) {
      throw Object.assign(new Error(`drive ${driveUUID} not found`), { status: 404 })
    }

    // validate prop names
    if (drive.type === 'private') {
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

    let nextDrive =  this.driveList.updatePublicDriveAsync(driveUUID, props)
    this.updateSamba()
    return nextDrive
  }

  getDriveDirs (user, driveUUID) {
    // FIXME should this 401 ?
    if (!this.userCanRead(user, driveUUID)) throw Object.assign(new Error('Permission Denied'), { status: 401 })
    return this.driveList.getDriveDirs(driveUUID)
  }

  async getDriveDirAsync (user, driveUUID, dirUUID, metadata, counter) {
    // FIXME should this 401 ?
    if (!this.userCanRead(user, driveUUID)) throw Object.assign(new Error('Permission Denied'), { status: 401 })
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) throw Object.assign(new Error('drive or dir not found'), { status: 404 })

    let path = dir.nodepath().map(dir => ({
      uuid: dir.uuid,
      name: dir.name,
      mtime: Math.abs(dir.mtime)
    }))

    let entries = await dir.readdirAsync()
    if (metadata) {
      entries.forEach(entry => {
        if (entry.type === 'file' && 
          Magic.isMedia(entry.magic) && 
          entry.hash && 
          this.mediaMap.hasMetadata(entry.hash)) { // TODO almost
          entry.metadata = this.mediaMap.getMetadata(entry.hash)
        }
      })
    }
    let dirCounter
    if(counter) dirCounter = this.getDirCounter(user, driveUUID, dirUUID)
    return counter ? { path, entries, 'counter':dirCounter } : { path, entries }
  }

  // this is slightly different from async versoin
  getDriveDir (user, driveUUID, dirUUID, opts, callback) {
    // FIXME user permission check
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      process.nextTick(() => callback(err))
    } else {
      dir.read(callback)
    }
  }

  getDriveDirPath (user, driveUUID, dirUUID) {
    // FIXME should this 401 ?
    if (!this.userCanRead(user, driveUUID)) throw Object.assign(new Error('Permission Denied'), { status: 401 })

    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) throw Object.assign(new Error('not found'), { status: 404 })
    return dir.abspath()
  }

  // async or sync ??? TODO
  getDriveFilePath (user, driveUUID, dirUUID, fileUUID, name) {

  }

  getTmpDir () {
    return path.join(this.fruitmixPath, 'tmp')
  }

  /// ////////// media api //////////////

  getMetaList (user) {
    if (!user) throw Object.assign(new Error('Invaild user'), { status: 400 })
    let drives = this.getDrives(user)
    let m = new Map()
    drives.forEach(drive => {
      let root = this.driveList.roots.get(drive.uuid)
      if (!root) return []
      root.preVisit(node => {
        if (node instanceof File && this.mediaMap.hasMetadata(node.hash)) { 
          m.set(node.hash, Object.assign({}, this.mediaMap.getMetadata(node.hash), { hash: node.hash })) 
        }
      })
    })
    return Array.from(m.values())
  }

  getDirCounter (user, driveUUID, dirUUID) {
    if (!this.userCanRead(user, driveUUID)) throw Object.assign(new Error('Permission Denied'), { status: 401 })
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) throw Object.assign(new Error('dir not found'), { status: 404 })
    let fileCount = 0, fileSize = 0, dirCount = 0, mediaCount = 0
    dir.postVisit(node => {
      if(node instanceof File) return mediaCount ++
      fileCount += node.fileCount
      fileSize += node.fileSize
      dirCount += node.dirCount
    })
    return { fileCount, fileSize, dirCount, mediaCount }
  }

  // NEW API
  getMetadata (user, fingerprint) {

    debug('getMetadata', user, fingerprint)

    this.assertUserCanReadMedia(user, fingerprint)

    // return Object.assign({}, this.mediaMap.get(fingerprint), { hash: fingerprint })
    let meta = this.mediaMap.get(fingerprint)
    if (!meta) return
    if (!meta.metadata) return
    return meta.metadata
    // return this.mediaMap.get(fingerprint)
  }

  getFingerprints (user, ...args) {
    // TODO: drive?
    return this.driveList.getFingerprints(...args)
  }

  getFilesByFingerprint (user, fingerprint) {
    this.assertUserCanReadMedia(user, fingerprint)
   
    let meta = this.mediaMap.get(fingerprint) 
    return meta ? meta.files.map(f => f.abspath()) : [] 
    
    // return this.driveList.getFilesByFingerprint(fingerprint)
  }


  // FIXME DONT mix async and callback error handlings
  getThumbnail (user, fingerprint, query, callback) {

    try {
      this.assertUserCanReadMedia(user, fingerprint)
    } catch (e) {
      return callback(e)
    }

    if (!this.mediaMap.has(fingerprint)) {
      let err = new Error('media not found')
      err.status = 404
      process.nextTick(() => callback(err))
    }

    let files = this.getFilesByFingerprint(user, fingerprint)
    if (files.length === 0) { return }

    let props = this.thumbnail.genProps(fingerprint, query)
    fs.lstat(props.path, (err, stat) => {
      if (!err) return callback(null, props.path)
      if (err.code !== 'ENOENT') return callback(err)

      // TODO add randomness
      callback(null, cb => this.thumbnail.convert(props, files[0], cb))
    })
  }

  /// ////////// task api ///////////////////////////////////////////////////////

  /**
  internally called by xcopy
  */
  cpdir (user, src, dst, policy, callback) {
    this.vfs.cpdir(src, dst, policy, callback)  
  }

  cpfile (user, src, dst, policy, callback) {
    this.vfs.cpfile(src, dst, policy, callback)
  }

  mvdir2 (user, src, dst, policy, callback) {
    this.vfs.mvdir(src, dst, policy, callback)
  }

  mvfile2 (user, src, dst, policy, callback) {
    this.vfs.mvfile(src, dst, policy, callback)
  } 

  mkdir2 (user, dst, policy, callback) {
    this.vfs.mkdir(dst, policy, callback)
  }

  mkfile (user, tmp, dst, policy, callback) {
    this.vfs.mkfile(tmp, dst, policy, callback)
  }

  clone (user, src, callback) {
    this.vfs.clone(src, callback)
  }

  readdir (user, driveUUID, dirUUID, callback) {
    this.vfs.readdir(driveUUID, dirUUID, callback)
  }
  
  getTasks (user, callback) {
    let tasks = this.tasks.filter(t => t.user.uuid === user.uuid).map(t => t.view())
    process.nextTick(() => callback(null, tasks))
  }

  getTask (user, taskUUID, callback) {
    let task = this.tasks.find(t => t.user.uuid === user.uuid && t.uuid === taskUUID) 
    if (task) {
      callback(null, task.view())
    } else {
      let err = new Error('task not found')
      err.code = 'ENOTFOUND'
      err.status = 404
      callback(err)
    }
  }

  genTmpPath(user) {
    return this.vfs.genTmpPath()
  }

  async createTaskAsync (user, props) {

    if (typeof props !== 'object' || props === null) {
      throw Object.assign(new Error('invalid'), { status: 400 })
    }

    let src, dst, task, entries
    if (props.type === 'copy' || props.type === 'move') {
      src = await this.getDriveDirAsync(user, props.src.drive, props.src.dir)
      dst = await this.getDriveDirAsync(user, props.dst.drive, props.dst.dir)
      entries = props.entries.map(uuid => {
        let xstat = src.entries.find(x => x.uuid === uuid)
        if (!xstat) throw new Error('entry not found')
        return xstat
      })

      if (props.type === 'copy') {
        task = new CopyTask(this, user, Object.assign({}, props, { entries }))
      } else {
        task = new MoveTask(this, user, Object.assign({}, props, { entries }))
      }
      this.tasks.push(task)
      return task.view()
    }

    throw new Error('invalid task type')
  }

  async createTaskAsync2 (user, props) {
    let { src, dst, policies, entries } = props
    // FIXME user
    let task = await xcopyAsync(this, user, props.type, policies, src, dst, entries)
    // task.user = user 
    this.tasks.push(task)

    // console.log(task.view())

    return task.view()
  }

  createTask (user, body, callback) {
    let { type, policies, src, dst, entries } = body
    let task = xcopy(this, user, type, policies, src, dst, entries, (err, task) => {
      if (err) {
        callback(err)
      } else {
        this.tasks.push(task)
        callback(null, task.view())
      }
    })
  }

  deleteTask (user, taskUUID, callback) {
    let index = this.tasks.findIndex(t => t.user.uuid === user.uuid && t.uuid === taskUUID) 
    if (index !== -1) {
      this.tasks[index].destroy()
      this.tasks.splice(index, 1)
    }

    process.nextTick(() => callback(null))
  }

  updateSubTask(user, taskUUID, nodeUUID, props, callback) {
    let task = this.tasks.find(t => t.user.uuid === user.uuid && t.uuid === taskUUID) 

    if (!task) {
      let err = new Error(`task ${taskUUID} not found`)
      err.code = 'ENOTFOUND'
      err.status = 404
      callback(err)
    } else {
      task.update(nodeUUID, props, callback)
    }
  }

  deleteSubTask (user, taskUUID, subTaskId, callback) {
    let task = this.tasks.find(t => t.user.uuid === user.uuid && t.uuid === taskUUID)
    if (!task) {
      let err = new Error(`task ${taskUUID} not found`)
      err.code = 'ENOTFOUND'
      err.status = 404
      callback(err)
    } else {
      task.delete(nodeUUID, callback)
    }
  }

  /// /////////////////////////
  // mkdirp make a new directory
  mkdirp (user, driveUUID, dirUUID, name, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let dst = path.join(dir.abspath(), name)
    mkdirp(dst, err => {
      if (err) return callback(err)
      readXstat(dst, (err, xstat) => {
        if (err) return callback(err)
        callback(null, xstat)
      })
    })
  }

  rimraf (user, driveUUID, dirUUID, name, uuid, callback) {
    // TODO permission check
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let dst = path.join(dir.abspath(), name)
    readXstat(dst, (err, xstat) => {
      // ENOENT treated as success
      if (err && err.code === 'ENOENT') return callback(null)
      if (err) return callback(err)
      if (xstat.uuid !== uuid) { return callback(Object.assign(new Error('uuid mismatch'), { status: 403 })) }

      rimraf(dst, err => callback(err))
    })
  }

  createNewFile (user, driveUUID, dirUUID, name, tmp, hash, overwrite, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let dst = path.join(dir.abspath(), name)
    if (overwrite) {
      readXstat(dst, (err, xstat) => {
        if (err) return callback(err)
        if (xstat.uuid !== overwrite) {
          let err = new Error('overwrite (uuid) mismatch')
          err.status = 403
          return callback(err)
        }

        forceXstat(tmp, { uuid: xstat.uuid, hash }, (err, xstat) => {
          if (err) return callback(err)
          // dirty TODO similar to test 0553082f, extract metadata
          Object.assign(xstat, { name })
          fs.rename(tmp, dst, err => {
            if (err) return callback(err)
            return callback(null, xstat)
          })
        })
      })
    } else {
      forceXstat(tmp, { hash }, (err, xstat) => {
        if (err) return callback(err)
        if (Magic.isMedia(xstat.magic)) {
          let { magic, uuid } = xstat
          // extract(tmp, magic, hash, uuid, (err, metadata) => {
            // ignore extract error
            // if (!err) this.mediaMap.setMetadata(hash, metadata)
            fs.link(tmp, dst, err => err ?  callback(err) : callback(null, Object.assign(xstat, { name })))
          // })
        } else {
          fs.link(tmp, dst, err => err ?  callback(err) : callback(null, Object.assign(xstat, { name })))
        }
      })
    }
  }

  /**
  data { path, size, sha256 }
  **/
  appendFile (user, driveUUID, dirUUID, name, hash, data, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let dst = path.join(dir.abspath(), name)
    readXstat(dst, (err, xstat) => {
      if (err) return callback(err)
      if (xstat.type !== 'file') return callback(Object.assign(new Error('not a file'), { code: 'EISDIR' }))
      if (xstat.hash !== hash) { return callback(new Error(`append (target) hash mismatch, actual: ${xstat.hash}`)) }
      if (xstat.size % (1024 * 1024 * 1024) !== 0) return callback(new Error('target size must be multiple of 1G')) 

      let tmp = path.join(this.getTmpDir(), UUID.v4())
      btrfsConcat(tmp, [dst, data.path], err => {
        if (err) return callback(err)

        fs.lstat(dst, (err, stat) => {
          if (err) return callback(err)
          if (stat.mtime.getTime() !== xstat.mtime) {
            let err = new Error('race detected')
            err.code = 'ERACE'
            return callback(err)
          }

          let fingerprint = xstat.size === 0
            ? data.sha256
            : combineHash(xstat.hash, data.sha256)

          forceXstat(tmp, { uuid: xstat.uuid, hash: fingerprint }, (err, xstat2) => {
            if (err) return callback(err)
            // dirty
            xstat2.name = name
            fs.rename(tmp, dst, err => {
              if (err) return callback(err)
              callback(null, xstat2)
            })
          })
        })
      })
    })
  }

  rename (user, driveUUID, dirUUID, fromName, toName, overwrite, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let fromPath = path.join(dir.abspath(), fromName)
    let toPath = path.join(dir.abspath(), toName)
    let tmpPath = path.join(this.getTmpDir(), UUID.v4())

    if (overwrite) {
      // if overwrite is provided, the uuid must be reserved
      readXstat(fromPath, (err, srcXstat) => {
        if (err) return callback(err)
        if (srcXstat.type !== 'file') {
          let e = new Error(`${fromName} is not a file`)
          return callback(e)
        }

        readXstat(toPath, (err, dstXstat) => {
          if (err) return callback(err)
          if (dstXstat.type !== 'file') {
            let e = new Error(`${toName} is not a file`)
            return callback(e)
          }

          if (dstXstat.uuid !== overwrite) {
            let e = new Error(`overwrite uuid mismatch, actual: ${dstXstat.uuid}`)
            return callback(e)
          }

          // 1. clone fromPath to tmpPath
          // 2. check xstat
          // 3. stamp tmpPath
          // 4. rename
          // 5. remove src
          btrfsClone(tmpPath, fromPath, err => {
            if (err) return callback(err)
            readXstat(fromPath, (err, xstat) => {
              if (err) {
                rimraf(tmpPath, () => {})
                return callback(err)
              }

              forceXstat(tmpPath, { uuid: dstXstat.uuid, hash: srcXstat.hash }, err => {
                if (err) {
                  rimraf(tmpPath, () => {})
                  return callback(err)
                }

                fs.rename(tmpPath, toPath, err => {
                  rimraf(tmpPath, () => {})
                  if (err) return callback(err)
                  rimraf(fromPath, err => {
                    if (err) return callback(err)
                    readXstat(toPath, callback)
                  })
                })
              })
            })
          })
        })
      })
    } else {
      // we cannot use fs.link because it may leave two files with the SAME uuid.
      fs.lstat(toPath, (err, stat) => {
        if (err) {
          if (err.code !== 'ENOENT') return callback(err)
          fs.rename(fromPath, toPath, err => err ? callback(err) : readXstat(toPath, callback))
        } else {
          let e = new Error('file or directory exists')
          e.code = 'EEXIST'
          callback(e)
        }
      })
    }
  }

  dup (user, driveUUID, dirUUID, fromName, toName, overwrite, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let fromPath = path.join(dir.abspath(), fromName)
    let toPath = path.join(dir.abspath(), toName)
    let tmpPath = path.join(this.getTmpDir(), UUID.v4())

    readXstat(fromPath, (err, srcXstat) => {
      if (err) return callback(err)
      if (srcXstat.type !== 'file') {
        let e = new Error(`${fromName} is not a file`)
        return callback(e)
      }

      btrfsClone(tmpPath, fromPath, err => {
        if (err) return callback(err)
        readXstat(fromPath, (err, xstat) => {
          if (err) return callback(err)
          if (xstat.uuid !== srcXstat.uuid || xstat.mtime !== srcXstat.mtime) {
            let e = new Error(`race condition detected, try again`)
            return callback(e)
          }

          if (overwrite) {
            readXstat(toPath, (err, dstXstat) => {
              if (err) return callback(err)
              if (dstXstat.type !== 'file') {
                let e = new Error(`${toName} is not a file`)
                return callback(e)
              }

              if (dstXstat.uuid !== overwrite) {
                let e = new Error(`uuid mismatch, actual: ${dstXstat.uuid}`)
                return callback(e)
              }

              let props = { uuid: dstXstat.uuid }
              if (srcXstat.hash) props.hash = srcXstat.hash

              forceXstat(tmpPath, props, err => {
                if (err) return callback(err)
                fs.rename(tmpPath, toPath, err => {
                  rimraf(tmpPath, () => {})
                  if (err) return callback(err)
                  readXstat(toPath, callback)
                })
              })
            })
          } else {
            forceXstat(tmpPath, { hash: srcXstat.hash }, (err, xstat) => {
              if (err) return callback(err)
              fs.link(tmpPath, toPath, err => {
                rimraf(tmpPath, () => {})
                if (err) return callback(err)
                readXstat(toPath, callback)
              })
            })
          }
        })
      })
    })
  }

  // callback returns 
  // ENOTEMPTY, ENOTDIR
  // this function try to move srcDirUUID into dstDirUUID
  // this function may fail if target exists (non-empty)
  mvdir_obsolete (user, srcDriveUUID, srcDirUUID, name, dstDriveUUID, dstDirUUID, callback) {
    let srcDir = this.driveList.getDriveDir(srcDriveUUID, srcDirUUID)
    if (!srcDir) return callback(new Error('source drive or dir not found'))
    if (srcDir.name !== name) return callback(new Error('source directory name mismatch'))
    if (srcDir.parent === null) return callback(new Error('source directory is root'))

    let dstDir = this.driveList.getDriveDir(dstDriveUUID, dstDirUUID)
    if (!dstDir) return callback(new Error('destination drive or dir not found'))

    let srcPath = srcDir.abspath()
    readXstat(srcPath, (err, xstat) => {
      if (err) return callback(err)
      if (xstat.uuid !== srcDir.uuid) {
        srcDir.parent.read()
        return callback(new Error('inconsistent data between in-memory cache and disk file system'))
      }

      let dstPath = path.join(dstDir.abspath(), name)
      try {
        fs.renameSync(srcPath, dstPath)
      } catch (e) {
        // ENOTEMPTY target is non-empty directory 
        // ENOTDIR target is not a directory
        return callback(e)
      }

      let srcParent = srcDir.parent
      srcDir.detach()
      srcDir.attach(dstDir)
      srcParent.read()
      dstDir.read()
      callback(null)
    })
  }

  mvdir (user, srcDriveUUID, srcDirUUID, name, dstDriveUUID, dstDirUUID, callback) {
    try {
      this.driveList.mvDirSync(srcDriveUUID, srcDirUUID, name, dstDriveUUID, dstDirUUID)
      process.nextTick(() => callback(null))
    } catch (e) {
      process.nextTick(() => callback(e))
    }
  }


  mvfile_obsolete (user, srcDriveUUID, srcDirUUID, fileUUID, name, dstDriveUUID, dstDirUUID, callback) {
    let srcDir = this.driveList.getDriveDir(srcDriveUUID, srcDirUUID)
    if (!srcDir) return callback(new Error('source drive or directory not found'))

    let dstDir = this.driveList.getDriveDir(dstDriveUUID, dstDirUUID)
    if (!dstDir) return callback(new Error('destination drive or directory not found'))

    let srcPath = path.join(srcDir.abspath(), name)
    readXstat(srcPath, (err, xstat) => {
      if (err) return callback(err)
      if (xstat.uuid !== fileUUID) return callback(new Error('uuid mismatch'))

      let dstPath = path.join(dstDir.abspath(), name)
      fs.lstat(dstPath, (err, stat) => {
        if (!err) return callback(new Error('target exists'))
        if (err.code !== 'ENOENT') return callback(err)

        // EISDIR rename file to existing directory
        fs.rename(srcPath, dstPath, err => {
          if (err) return callback(err)
          srcDir.read()
          dstDir.read()
          callback(null)
        })
      })
    })
  }

  mvfile (user, srcDriveUUID, srcDirUUID, fileUUID, fileName, dstDriveUUID, dstDirUUID, callback) {
    try {
      this.driveList.mvFileSync(srcDriveUUID, srcDirUUID, fileUUID, fileName, dstDriveUUID, dstDirUUID)
      console.log('mvfile done')
      process.nextTick(() => callback(null))
    } catch (e) {
      console.log('mvfile', e)
      process.nextTick(() => callback(e))
    }
  }

  // for test
  assertDirUUIDsIndexed (uuids) {
    this.driveList.assertDirUUIDsIndexed (uuids)
  }

  getTagedFiles (user, tags, callback) {
    if (!user) return process.nextTick(() => callback(Object.assign(new Error('Invaild user'), { status: 400 })))
    if (!tags || !Array.isArray(tags) || !tags.length) return process.nextTick(() => callback(Object.assign(new Error('Invaild tags'), { status: 400 })))
    let drives = this.getDrives(user)
    let m = []
    drives.forEach(drive => {
      let root = this.driveList.roots.get(drive.uuid)
      // if (!root) return []
      root.preVisit(node => {
        if (node instanceof File && node.tags && tags.findIndex(t => node.tags.includes(t)) !== -1) { 
          m.push({
            uuid: node.uuid,
            name: node.name,
            driveUUID: drive.uuid,
            dirUUID: node.parent.uuid
          })
        }
      })
    })
    return callback(null, m)
  }

  getFilePathByUUID(user, fileUUID) {
    let fileNode = this.driveList.fileMap.get(fileUUID)
    if(!fileNode) return
    let root = fileNode.root()
    if(this.userCanRead(user, root.uuid)) return fileNode.abspath()
    return 
  }

}

// Object.assign(Fruitmix.prototype, {})
Object.assign(Fruitmix.prototype, driveapi)
Object.assign(Fruitmix.prototype, ndriveapi)
Object.assign(Fruitmix.prototype, boxapi)
Object.assign(Fruitmix.prototype, tagapi)

module.exports = Fruitmix




