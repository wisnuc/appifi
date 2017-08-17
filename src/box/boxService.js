const Promise = require('bluebird')
const uuid = require('uuid')
const path = require('path')
const UUID = require('uuid')
const fs = require('fs')
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const User = require('../models/user')
const boxData = require('./box/boxData')

const { isUUID, validateProps } = require('../common/assertion')
const E = require('../lib/error')

class BoxService {
  constructor(User, boxData) {
    this.User = User
    this.boxData = boxData
  }

  /**
   * get all box descriptors user can access
   * @param {Object} user
   * @return {array} a docList of boxes user can view
   */
  getAllBoxes(user) {
    let global = user.global
    return this.boxData.getAllBoxes(global)
  }

  // return a box doc
  /**
   * get a box descriptor
   * @param {Object} user
   * @param {string} boxUUID - uuid of box
   */
  getBox(user, boxUUID) {
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    let doc = box.doc
    if (doc.owner !== global && !doc.users.includes(global)) throw new E.EACCESS()
    return doc
  }

  // props {name, users:[]}
  /**
   * create a new box
   * @param {Object} user 
   * @param {Object} props
   * @param {string} props.name - name of box to be created
   * @param {array} props.users - collection of global ID string
   * @return {Object} box descriptor (doc)
   */
  async createBoxAsync(user, props) {
    let u = this.User.users.find(u => u.uuid === user.uuid)
    if (!u || user.global !== u.global) throw new E.EACCESS()
    validateProps(props, ['name', 'users'], [])
    
    props.owner = user.global
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
   * @return {Object} new descriptor of box
   */
  async updateBoxAsync(user, boxUUID, props) {
    let u = this.User.users.find(u => u.uuid === user.uuid)
    if (!u || user.global !== u.global) throw new E.EACCESS()

    if (!isUUID(boxUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    if (box.doc.owner !== user.global) throw new E.EACCESS()
    
    return await this.boxData.updateBoxAsync(props, boxUUID)
  }

  /**
   * delete a box, only box owner is allowed
   * @param {Object} user 
   * @param {string} boxUUID 
   */
  async deleteBoxAsync(user, boxUUID) {
    let u = this.User.users.find(u => u.uuid === user.uuid)
    if (!u || user.global !== u.global) throw new E.EACCESS()

    if (!isUUID(boxUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    if (box.doc.owner !== user.global) throw new E.EACCESS()
    return await this.boxData.deleteBoxAsync(boxUUID)
  }

  /**
   * get all branches
   * @param {Object} user 
   * @param {string} boxUUID 
   */
  async getAllBranchesAsync(user, boxUUID) {
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    if (box.doc.owner !== global && !box.doc.users.includes(global))
      throw new E.EACCESS()
    
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
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    if (!isUUID(branchUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    if (box.doc.owner !== global && !box.doc.users.includes(global))
      throw new E.EACCESS()

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
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    if (box.doc.owner !== global && !box.doc.users.includes(global))
      throw new E.EACCESS()

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
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    if (!isUUID(branchUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    if (box.doc.owner !== global && !box.doc.users.includes(global))
      throw new E.EACCESS()

    return await box.updateBranchAsync(branchUUID, props)
  }

  /**
   * delete a branch
   * @param {Object} user 
   * @param {string} boxUUID 
   * @param {string} branchUUID 
   */
  async deleteBranchAsync(user, boxUUID, branchUUID) {
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    if (!isUUID(branchUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    if (box.doc.owner !== global && !box.doc.users.includes(global))
      throw new E.EACCESS()

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
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    if (box.doc.owner !== global && !box.doc.users.includes(global))
      throw new E.EACCESS()

    return await box.getTweetsAsync(props)
  }

  // FIXME:   contents in props ?
  /**
   * 
   * @param {Object} user 
   * @param {string} boxUUID 
   * @param {Object} props
   * @param {string} props.comment
   * @param {string} props.type - blob, list, branch, commit, job, tag
   * @param {string} props.id - sha256 or uuid, for blob, branch, commit, job, tag
   * @param {array} props.list - [{sha256, filename}], only for list
   * @param {string} props.global - user global ID
   * @param {array} props.src - {sha256, filepath}, for blob and list
   * @return {Object} tweet object
   */
  async createTweetAsync(user, boxUUID, props) {
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    if (box.doc.owner !== global && !box.doc.users.includes(global))
      throw new E.EACCESS()

    return await box.createTweetAsync(props)
  }

  /**
   * delete tweets
   * add tweetsID into blacklist
   * @param {Object} user 
   * @param {string} boxUUID 
   * @param {array} tweetsID - list of tweets ID to be deleted
   */
  async deleteTweetsAsync(user, boxUUID, tweetsID) {
    if (!isUUID(boxUUID)) throw new E.EINVAL()
    let box = this.boxData.getBox(boxUUID)
    if (!box) throw new E.ENOENT()

    let global = user.global
    if (box.doc.owner !== global && !box.doc.users.includes(global))
      throw new E.EACCESS()

    return await box.deleteTweetsAsync(tweetsID)
  }
}





