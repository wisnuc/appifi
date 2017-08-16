const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const UserList = require('./user/user')
const DriveList = require('./forest/forest')

/**
Fruitmix is the facade of internal modules, including user, drive, forest, and box.

Fruitmix is responsible for authorization, but not authentication.

Station module and all routers consumes only Fruitmix API. They are NOT allowed to
bypass the facade to access the internal modules.

Fruitmix is also responsible for initialize all internal modules and paths.
*/
class Fruitmix extends EventEmitter {


  /**
  @params {string} froot - fruitmix root path, should be an normalized absolute path
  */
  constructor (froot) {
    super()
    this.fruitmixPath = froot
    this.userList = new UserList(froot)
    this.driveList = new DriveList(froot)
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
      avatar: u.avatar
    }))
  }

  /**
  */
  async createUserAsync (props) {
    let user = await this.userList.createUserAsync(props)
    let drive = await this.driveList.createPrivateDriveAsync(user.uuid, 'home') 
    return user
  }

  /**
  */
  userUpdatePassword() {
    this.User.updatePassword()
  }

  verifyUserPassword (userUUID, password, done) {
    this.userList.verifyPassword(userUUID, password, done)
  }

  findUserByUUID(userUUID) {
    return this.userList.findUser(userUUID)
  }

  async updateUserAsync(user, userUUID, body) {
    return this.userList.updateUserAsync(userUUID, body) 
  }

  getDrives (user) {

    let drives = this.driveList.drives.filter(drv => {
      if (drv.type === 'private' && drv.owner === user.uuid) return true
      if (drv.type === 'public' && 
        (drv.writelist.includes(user.uuid) || drv.readlist.includes(user.uuid))) {
        return true
      }
      return false
    })

    return drives
  }

  async createPublicDriveAsync(user, props) {
    return this.driveList.createPublicDriveAsync(props)
  }

  getDriveDirs (user, driveUUID) {
    if (!this.driveList.roots.has(driveUUID)) 
      throw Object.assign(new Error('drive not found'), { status: 404 })

    return this.driveList.getDriveDirs(driveUUID)
  }

  async getDriveDirAsync (user, driveUUID, dirUUID) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) throw Object.assign(new Error('drive or dir not found'), { status: 404 })
    return {
      path: dir.nodepath().map(dir => ({
        uuid: dir.uuid,
        name: dir.name,
        mtime: Math.abs(dir.mtime)
      })),
      entries: await dir.readdirAsync()
    }
  }

  getDriveDirPath (user, driveUUID, dirUUID) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) throw 404 // FIXME
    return dir.abspath()
  }

  getTmpDir () {
    return path.join(this.fruitmixPath, 'tmp')
  }

}

const broadcast = require('./common/broadcast')

let fruitmix = null

broadcast.on('FruitmixStart', froot => {
  try {
    fruitmix = new Fruitmix(froot)
    // !!! guarantee to be async
    process.nextTick(() => broadcast.emit('FruitmixStarted'))
  } catch (e) {
    console.log(e)
  }
})

// TODO
broadcast.on('FruitmixStop', () => {
  fruitmix = null
})

module.exports = () => fruitmix

