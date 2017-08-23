const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const UserList = require('./user/user')
const DriveList = require('./forest/forest')
const BoxData = require('./box/boxData')

const { assert, isUUID, isSHA256, validateProps } = require('./common/assertion')

const CopyTask = require('./tasks/fruitcopy')

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
    this.boxData = new BoxData(froot)
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

  getUsers () {
    return this.userList.users.map(u => ({
      uuid: u.uuid,
      username: u.username,
      isFirstUser: u.isFirstUser,
      isAdmin: u.isAdmin,
      avatar: u.avatar, 
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

 
  /**
  isFirstUser never allowed to change.
  possibly allowed props: username, isAdmin, global

  If user is super user, userUUID is itself
    allowed: username, global
  If user is super user, userUUID is not itself
    allowed: isAdmin, 
  */ 
  async updateUserAsync(user, userUUID, body) {

    if (body.hasOwnProperty('uuid'))
      throw Object.assign(new Error('uuid is not allowed to change'), { status: 403 })

    if (body.hasOwnProperty('isFirstUser'))
      throw Object.assign(new Error('isFirstUser is not allowed to change'), { status: 403 })

    if (body.hasOwnProperty('avatar'))
      throw Object.assign(new Error('avatar is not allowed to change'), { status: 403 })

    if (body.hasOwnProperty('global')) {
      if (typeof body.global !== 'object') 
        throw Object.assign(new Error('invalid global property'), { status: 400 })
    }

    if (user.isFirstUser) {
      if (user.uuid === userUUID) {
        if (body.hasOwnProperty('isAdmin')) {
          throw Object.assign(new Error('isAdmin is not allowed to change for super user'), {
            status: 403
          })
        } 
      } else {
      }
    }

    return await this.userList.updateUserAsync(userUUID, body) 
  }

  async updateUserPasswordAsync(user, body) {

    if (typeof body.password !== 'string') {
      throw Object.assign(new Error('bad format'), { status: 400 })
    }

    await this.userList.updatePasswordAsync(user.uuid, body.password) 
  }

  async getMediaBlacklistAsync(user) {

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

  async setMediaBlacklistAsync(user, props) {

    // TODO must all be sha256 value

    if (!Array.isArray(props) || !props.every(x => isSHA256(x)))
      throw Object.assign(new Error('invalid parameters'),
        { status: 400 })

    let dirPath = path.join(this.fruitmixPath, 'users', user.uuid)
    await mkdirpAsync(dirPath)
    let filePath = path.join(this.fruitmixPath, 'users', user.uuid, 'media-blacklist.json')
    await fs.writeFileAsync(filePath, JSON.stringify(props)) 
  }

  async addMediaBlacklistAsync(user, props) {

    if (!Array.isArray(props) || !props.every(x => isSHA256(x)))
      throw Object.assign(new Error('invalid parameters'),
        { status: 400 })

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

  async subtractMediaBlacklistAsync(user, props) {

    if (!Array.isArray(props) || !props.every(x => isSHA256(x)))
      throw Object.assign(new Error('invalid parameters'),
        { status: 400 })

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

   ///////////////// box api ///////////////////////

  /**
   * get all box descriptions user can access
   * @param {Object} user
   * @return {array} a docList of boxes user can view
   */
  getAllBoxes(user) {
    let guid = user.global.id
    return this.boxData.getAllBoxes(guid)
  }

  // return a box doc
  /**
   * get a box description
   * @param {Object} user
   * @param {string} boxUUID - uuid of box
   */
  getBox(user, boxUUID) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let guid = user.global.id
    let doc = box.doc
    if (doc.owner !== guid && !doc.users.includes(guid)) 
      throw Object.assign(new Error('no permission'), { status: 403 })
    return doc
  }

  // props {name, users:[]}
  /**
   * create a new box
   * @param {Object} user 
   * @param {Object} props
   * @param {string} props.name - name of box to be created
   * @param {array} props.users - collection of global ID string
   * @return {Object} box description (doc)
   */
  async createBoxAsync(user, props) {
    let u = this.findUserByUUID(user.uuid)
    if (!u || user.global.id !== u.global.id) 
      throw Object.assign(new Error('no permission'), { status: 403 })
    validateProps(props, ['name', 'users'])
    assert(typeof props.name === 'string', 'name should be a string')
    assert(Array.isArray(props.users), 'users should be an array')
    // FIXME: check user global ID in props.users ?
    
    props.owner = user.global.id
    return await this.boxData.createBoxAsync(props)
  }

  // update name and users, only box owner is allowed
  // props {name, users: {op: add/delete, value: [user global ID]}}
  /**
   * update a box, name, users or mtime
   * @param {Object} user 
   * @param {string} boxUUID - uuid of box to be updated
   * @param {Object} props
   * @param {string} props.name - optional, new name of box
   * @param {Object} props.users - optional, {op: add/delete, value: [user global ID]}
   * @param {number} props.mtime - optional
   * @return {Object} new description of box
   */
  async updateBoxAsync(user, boxUUID, props) {
    let u = this.findUserByUUID(user.uuid)
    if (!u || user.global.id !== u.global.id) 
      throw Object.assign(new Error('no permission'), { status: 403 })

    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    if (box.doc.owner !== user.global.id) 
      throw Object.assign(new Error('no permission'), { status: 403 })

    validateProps(props, [], ['name', 'users', 'mtime'])
    if (props.name) assert(typeof props.name === 'string', 'name should be a string')
    if (props.users) {
      assert(typeof props.users === 'object', 'users should be an object')
      assert(props.users.op === 'add' || props.users.op === 'delete', 'operation should be add or delete')
      assert(Array.isArray(props.users.value), 'value should be an array')
    }
    
    return await this.boxData.updateBoxAsync(props, boxUUID)
  }

  /**
   * delete a box, only box owner is allowed
   * @param {Object} user 
   * @param {string} boxUUID 
   */
  async deleteBoxAsync(user, boxUUID) {
    let u = this.findUserByUUID(user.uuid)
    if (!u || user.global.id !== u.global.id) 
      throw Object.assign(new Error('no permission'), { status: 403 })

    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    if (box.doc.owner !== user.global.id) 
      throw Object.assign(new Error('no permission'), { status: 403 })
    return await this.boxData.deleteBoxAsync(boxUUID)
  }

  /**
   * get all branches
   * @param {Object} user 
   * @param {string} boxUUID 
   * @return {array} a list of branch descriptions
   */
  async getAllBranchesAsync(user, boxUUID) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let guid = user.global.id
    if (box.doc.owner !== guid && !box.doc.users.includes(guid))
      throw Object.assign(new Error('no permission'), { status: 403 })
    
    return await box.retrieveAllAsync('branches')
  }

  /**
   * get a branch information
   * @param {Object} user 
   * @param {string} boxUUID 
   * @param {string} branchUUID 
   * @return {Object} branch information
   */
  async getBranchAsync(user, boxUUID, branchUUID) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    if (!isUUID(branchUUID)) throw Object.assign(new Error('invalid branchUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let guid = user.global.id
    if (box.doc.owner !== guid && !box.doc.users.includes(guid))
      throw Object.assign(new Error('no permission'), { status: 403 })

    return await box.retrieveAsync('branches', branchUUID)
  }

  // props {name, head}
  /**
   * create a new branch
   * @param {Object} user 
   * @param {string} boxUUID
   * @param {Object} props 
   * @param {string} props.name - branch name
   * @param {string} props.head - sha256, a commit hash
   * @return {object} description of branch
   */
  async createBranchAsync(user, boxUUID, props) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let guid = user.global.id
    if (box.doc.owner !== guid && !box.doc.users.includes(guid))
      throw Object.assign(new Error('no permission'), { status: 403 })

    validateProps(props, ['name', 'head'])
    assert(typeof props.name === 'string', 'name should be a string')
    assert(isSHA256(props.head), 'head should be a sha256')

    return await box.createBranchAsync(props)
  }

  // props {name, head}
  /**
   * updata a branch, name or head
   * @param {Object} user 
   * @param {string} boxUUID 
   * @param {string} branchUUID 
   * @param {Object} props 
   * @param {string} props.name - new name of branch
   * @param {string} props.head - sha256, new commit hash
   * @return {Object} new description of branch
   */
  async updateBranchAsync(user, boxUUID, branchUUID, props) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    if (!isUUID(branchUUID)) throw Object.assign(new Error('invalid branchUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let guid = user.global.id
    if (box.doc.owner !== guid && !box.doc.users.includes(guid))
      throw Object.assign(new Error('no permission'), { status: 403 })
    
    validateProps(props, [], ['name', 'head'])
    if (props.name) assert(typeof props.name === 'string', 'name should be a string')
    if (props.head) assert(isSHA256(props.head), 'head should be a sha256')

    return await box.updateBranchAsync(branchUUID, props)
  }

  async deleteBranchAsync(user, boxUUID, branchUUID) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    if (!isUUID(branchUUID)) throw Object.assign(new Error('invalid branchUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let guid = user.global.id
    if (box.doc.owner !== guid && !box.doc.users.includes(guid))
      throw Object.assign(new Error('no permission'), { status: 403 })

    return await box.deleteBranchAsync(branchUUID)
  }

  // props {first, last, count, segments}
  /**
   * get appointed segments
   * segments: '3:5|7:10|20:30'
   * @param {Object} user 
   * @param {string} boxUUID 
   * @param {Object} props
   * @param {number} props.first - optional, the first index of segment user hold 
   * @param {number} props.last - optional, the last index of segment user hold
   * @param {number} props.count - optional, number of records user want to get
   * @param {string} props.segments - optional, segments of records user want to get
   */
  async getTweetsAsync(user, boxUUID, props) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let guid = user.global.id
    if (box.doc.owner !== guid && !box.doc.users.includes(guid))
      throw Object.assign(new Error('no permission'), { status: 403 })

    validateProps(props, [], ['first', 'last', 'count', 'segments'])
    if (props.first) assert(Number.isInteger(props.first), 'first should be an integer')
    if (props.last) assert(Number.isInteger(props.last), 'last should be an integer')
    if (props.count) assert(Number.isInteger(props.count), 'count should be an integer')
    if (props.last) assert(typeof props.segments === 'string', 'segments should be a string')

    return await box.getTweetsAsync(props)
  }

  /**
   * 
   * @param {Object} user 
   * @param {string} boxUUID 
   * @param {Object} props
   * @param {string} props.comment
   * @param {string} props.type - blob, list, branch, commit, job, tag
   * @param {string} props.id - sha256 or uuid, for blob, branch, commit, job, tag
   * @param {array} props.list - [{sha256, filename}], only for list
   * @param {Object} props.global - user global object
   * @param {array} props.path - {sha256, filepath}, for blob and list
   * @return {Object} tweet object
   */
  async createTweetAsync(user, boxUUID, props) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let global = user.global
    if (box.doc.owner !== global.id && !box.doc.users.includes(global.id))
      throw Object.assign(new Error('no permission'), { status: 403 })
    
    props.global = global
    
    validateProps(props, ['global', 'comment'], ['type', 'id', 'list', 'src'])
    assert(typeof props.comment === 'string', 'comment should be a string')
    assert(typeof props.global === 'object', 'global should be an object')
    if (props.type) assert(typeof props.type === 'string', 'type should be a string')
    if (props.id) assert(isSHA256(props.id) || isUUID(props.id), 'id should be sha256 or uuid')
    if (props.list) assert(Array.isArray(props.list), 'list should be an array')
    if (props.src) assert(Array.isArray(props.src), 'src should be an array')
    
    let result =  await box.createTweetAsync(props)
    await this.boxData.updateBoxAsync({mtime: result.mtime}, boxUUID)
    return result.tweet
  }

  /**
   * delete tweets
   * add tweetsID into blacklist
   * @param {Object} user 
   * @param {string} boxUUID 
   * @param {array} tweetsID - list of tweets ID to be deleted
   */
  async deleteTweetsAsync(user, boxUUID, tweetsID) {
    if (!isUUID(boxUUID)) throw Object.assign(new Error('invalid boxUUID'), { status: 400 })
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })

    let guid = user.global.id
    if (box.doc.owner !== guid && !box.doc.users.includes(guid))
      throw Object.assign(new Error('no permission'), { status: 403 })

    return await box.deleteTweetsAsync(tweetsID)
  }  

  ///////////// media api //////////////

  getFingerprints (user, ...args) {
    return this.driveList.getFingerprints(...args)
  }

  getFilesByFingerprint (user, fingerprint) {
    return this.driveList.getFilesByFingerprint(fingerprint)
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

