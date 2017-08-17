const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const UserList = require('./user/user')
const DriveList = require('./forest/forest')

const CopyTask = require('./tasks/dircopy')

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

    this.tasks = []
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

  // async or sync ??? TODO
  getDriveFilePath (user, driveUUID, dirUUID, fileUUID, name) {
    
  }

  getTmpDir () {
    return path.join(this.fruitmixPath, 'tmp')
  }

  ///////////// task api ///////////////////////////////////////////////////////

  getTasks (user) {
    return this.tasks
      .filter(t => t.user.uuid === user.uuid)
      .map(t => t.view())
  }

  async createTaskAsync (user, props) {
    if (typeof props !== 'object' || props === null)
      throw new Error('invalid')

    let src, dst, task
    switch(props.type) {
    case 'copy':
      src = await this.getDriveDirAsync(user, props.src.drive, props.src.dir) 
      dst = await this.getDriveDirAsync(user, props.dst.drive, props.dst.dir)
      let entries = props.entries.map(uuid => {
        let xstat = src.entries.find(x => x.uuid === uuid)
        if (!xstat) throw new Error('entry not found')
        return xstat
      })

      task = new CopyTask(this, user, Object.assign({}, props, { entries }))
      this.tasks.push(task)
      return task.view()

    default:
      throw new Error('invalid task type')
    } 
  }

  createTask (user, props, callback) {
    if (typeof props !== 'object' || props === null) {
      return process.nextTick(() => callback(new Error('invalid')))
    }

    let task

    switch(props.type) {
    case 'copy':
      this.getDriveDirAsync(user, props.src.drive, props.src.dir)
        .then(src => {
          this.getDriveDirAsync(user, props.dst.drive, props.dst.dir)
            .then(dst => {
              console.log(dst)
            })
            .catch(callback)
        })
        .catch(callback)

      // this.getDriveDir
      // task = new CopyTask(this, user, props)
      // this.tasks.push(task)
      break
    default:
      return process.nextTick(() => callback(new Error('invalid')))
    }

    // process.nextTick(() => callback(null, task.view()))
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

