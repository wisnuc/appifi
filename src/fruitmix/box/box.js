const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')
const deepEqual = require('deep-equal')

const broadcast = require('../../common/broadcast')
const { saveObjectAsync } = require('../lib/utils')
const E = require('../lib/error')

/**
 * @module Box
 */

/**
 * add array
 * @param {array} a
 * @param {array} b
 * @return {array} union of a and b
 */
const addArray = (a, b) => {
  let c = Array.from(new Set([...a, ...b]))
  return deepEqual(a, c) ? a :c
}

/**
 * 
 * @param {array} a 
 * @param {array} b 
 * @return {array} elements not in b
 */
const complement = (a, b) => 
  a.reduce((acc, c) => 
    b.includes(c) ? acc : [...acc, c], [])

/*
  fruitmix/repo          // store blob 
          /boxes
            [uuid]/
              manifest  // 
              commits   // database
              pull/push //
*/


/**

*/
class Box {

  /**
   * @param {string} dir - root path of box
   * @param {string} tmpDir - temporary directory path
   * @param {Object} doc - document of box
   */
  constructor(dir, tmpDir, doc) {
    this.dir = dir
    this.tmpDir = tmpDir
    this.doc = doc
    // this.branchMap = new Map()
  }

  /**
   * create a branch
   * @param {Object} props 
   * @param {string} props.name - branch name
   * @param {string} props.head - SHA256, a commit ref
   * @return {Object} branch
   */
  async createBranchAsync(props) {
    let branch = {
      uuid: UUID.v4(),
      name: props.name,
      head: props.head
    }

    let targetDir = path.join(this.dir, 'branches')
    await mkdirpAsync(targetDir)
    let targetPath = path.join(targetDir, branch.uuid)
    await saveObjectAsync(targetPath, this.tmpDir, branch)
    // this.branchMap.set(branch.uuid, branch)
    return branch
  }

  /**
   * retrieve a branch content
   * @param {string} type - branches or commits
   * @param {string} id - branch uuid or commit hash
   * @param {function} callback 
   * @return {Object} branch content
   */
  // retrieveBranch(uuid, callback) {
  //   let srcpath = path.join(this.dir, 'branches', uuid)
  //   fs.readFile(srcpath, (err,data) => {
  //     if(err) return callback(err)
  //     try{
  //       callback(null, JSON.parse(data.toString()))
  //     }
  //     catch(e) {
  //       callback(e)
  //     }
  //   })
  // }

  retrieve(type, id, callback) {
    let srcpath = path.join(this.dir, type, id)
    fs.readFile(srcpath, (err,data) => {
      if(err) return callback(err)
      try{
        callback(null, JSON.parse(data.toString()))
      }
      catch(e) {
        callback(e)
      }
    })
  }

  /**
   * async edition of retrieveBranch
   * @param {string} type - branches or commits
   * @param {string} id - branch uuid or commit hash
   * @return {Object} branch content
   */
  async retrieveAsync(type, id) {
    return Promise.promisify(this.retrieve).bind(this)(type, id)
  }

  /**
   * retrieve all branches
   * @param {string} type - branches or commits
   * @param {function} callback 
   * @return {array} branches
   */
  // retrieveAllBranches(callback) {
  //   let target = path.join(this.dir, 'branches')
  //   fs.readdir(target, (err, entries) => {
  //     if(err) return callback(err)

  //     let count = entries.length
  //     if (!count) return callback(null, [])

  //     let result = []
  //     entries.forEach(entry => {
  //       this.retrieveBranch(entry, (err, obj) => {
  //         if (!err) result.push(obj)
  //         if (!--count) callback(null, result)
  //       })
  //     })
  //   })
  // }

  retrieveAll(type, callback) {
    let target = path.join(this.dir, type)
    fs.readdir(target, (err, entries) => {
      if(err) return callback(err)

      let count = entries.length
      if (!count) return callback(null, [])

      let result = []
      entries.forEach(entry => {
        this.retrieve(type, entry, (err, obj) => {
          if (!err) result.push(obj)
          if (!--count) callback(null, result)
        })
      })
    })
  }

  /**
   * async edition of retrieveAllBranches
   * @return {array} branches
   */
  async retrieveAllAsync(type) {
    return Promise.promisify(this.retrieveAll).bind(this)(type)
  }

  /**
   * update a branch doc
   * @param {string} branchUUID - uuid string
   * @param {Object} props - properties to be updated
   * @param {string} props.name - optional, branch name
   * @param {string} props.head - optional, commit hash
   */
  async updateBranchAsync(branchUUID, props) {
    let target = path.join(this.dir, 'branches', branchUUID)
    let branch = await this.retrieveAsync('branches', branchUUID)

    let {name, head} = props
    if(head) {
      let obj = await this.retrieveAsync('commits', head)
      if(obj.parent !== branch.head) throw new E.ECONTENT()
    }

    let updated = {
      uuid: branch.uuid,
      name: name || branch.name,
      head: head || branch.head
    }

    if(updated === branch) return branch    
    await saveObjectAsync(target, this.tmpDir, updated)
    return updated
  }

  async deleteBranchAsync(branchUUID) {
    let target = path.join(this.dir, 'branches', branchUUID)
    await rimrafAsync(target)
    return
  }

    /**
   * create a commit
   * @param {Object} props 
   * @param {string} props.tree - hash string
   * @param {array} props.parent - parent commit
   * @param {string} props.user - user unionId
   * @param {string} props.comment - comment for the commit
   * @return {string} hash
   */
  async createCommitAsync(props) {
    let commit = {
      tree: props.tree,
      parent: props.parent,
      user: props.user,
      ctime: new Date().getTime(),
      comment: props.comment
    }

    return await this.storeObjectAsync(commit)
  }

  async createTwitAsync() {
    
  }

}

/**
 * 
 */
class BoxData {

  constructor() {

    this.initialized = false

    this.dir = undefined
    this.tmpDir = undefined
    this.map = undefined

    broadcast.on('FruitmixStart', froot => {
    
      let dir = path.join(froot, 'boxes')
      let tmpDir = path.join(froot, 'tmp') 

      this.init(dir, tmpDir)
    })

    broadcast.on('FruitmixStop', () => this.deinit())
  }

  init(dir, tmpDir) {

    mkdirp(dir, err => {

      if (err) {
        console.log(err) 
        broadcast.emit('BoxInitDone', err)
        return
      }

      this.initialized = true
      this.dir = dir
      this.tmpDir = tmpDir
      this.map = new Map()

      broadcast.emit('BoxInitDone')
    })
  }

  deinit() {

    this.initialized = false
    this.dir = undefined
    this.tmpDir = undefined
    this.map = undefined

    process.nextTick(() => broadcast.emit('BoxDeinitDone'))
  }

/**
  async initAsync(boxesDir, tmpDir) {

    this.dir = boxesDir
    this.tmpDir = tmpDir
    this.map = new Map()

    await mkdirpAsync(this.dir)
  }
**/

/**
 * Create a box
 * 
 * @param {Object} props - props
 * @param {string} props.name - non-empty string, no conflict with existing box name
 * @param {string} props.owner - box owner, unionId
 * @param {array} props.users - empty or unionId array
 * @return {Object} box 
 */
  async createBoxAsync(props) {

    // create temp dir  
    // save manifest to temp dir
    // move to boxes dir

    let tmpDir = await fs.mkdtempAsync(path.join(this.tmpDir, 'tmp'))
    let doc = {
      uuid: UUID.v4(),
      name: props.name,
      owner: props.owner,
      users: props.users
    }  

    // FIXME refactor saveObject to avoid rename twice
    await saveObjectAsync(path.join(tmpDir, 'manifest'), this.tmpDir, doc)
    await fs.renameAsync(tmpDir, path.join(this.dir, doc.uuid))
    let box = new Box(path.join(this.dir, doc.uuid), this.tmpDir, doc)

    this.map.set(doc.uuid, box)
    return box
  }

/**
 * update a box (rename, add or delete users)
 * 
 * @param {array} props - properties to be updated
 * @param {object} box - contents before update
 * @return {object} newbox
 */
  async updateBoxAsync(props, box) {
    let op
    let { name, users } = box.doc

    op = props.find(op => (op.path === 'name' && op.operation === 'update'))
    if(op) name = op.value

    op = props.find(op => (op.path === 'users' && op.operation === 'add'))
    if(op) users = addArray(users, op.value)

    op = props.find(op => (op.path === 'users' && op.operation === 'delete'))
    if(op) users = complement(users, op.value)

    if(name === box.doc.name && users === box.doc.users) return box

    let newDoc = {
      uuid: box.doc.uuid,
      name,
      owner: box.doc.owner,
      users
    }

    await saveObjectAsync(path.join(this.dir, box.doc.uuid, 'manifest'), this.tmpDir, newDoc)
    
    box.doc = newDoc
    this.map.set(box.doc.uuid, box)

    return box
  }

/**
 * delete a box
 * 
 * @param {string} boxUUID - uuid of box to be deleted
 */
  async deleteBoxAsync(boxUUID) {
    await rimrafAsync(path.join(this.dir, boxUUID))
    this.map.delete(boxUUID)
    return
  }
}

module.exports = new BoxData()
