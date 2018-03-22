const Promise = require('bluebird')
const path = require('path')
const Stringify = require('canonical-json')
const fs = Promise.promisifyAll(require('fs'))
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')
const crypto = require('crypto')

const { fileMagic6 } = require('../lib/xstat')
const { saveObjectAsync } = require('../lib/utils')
const E = require('../lib/error')
const { isSHA256, complementArray } = require('../lib/assertion')


/**
  box
*/
class Box {

  /**
   * @param {Object} ctx - context
   * @param {string} dir - root path of box
   * @param {Object} doc - document of box
   * @param {Object} DB - tweetsDB
   */
  constructor(ctx, dir, doc, DB) {
    // this.ctx is boxData, this.ctx.ctx is fruitmix
    this.ctx = ctx
    this.dir = dir
    this.doc = doc
    this.DB = DB
    this.files = new Set()
    this.ctx.indexBox(this)
    try{
      mkdirp.sync(path.join(this.dir, 'branches'))
    }catch(e){console.log(e)}
  }

  destory() {
    this.files.clear()
    this.files = undefined
    this.DB = undefined
    this.ctx.unindexBox(this)
  }

  read(callback) {
    Promise.all([
      // new Promise((resolve, reject) => {
      //   this.readTree((err, files) => err ? reject(err) : resolve(files))
      // }), 
      new Promise((resolve, reject) => this.DB.read((err, files) => err ? reject(err) : resolve(files)))
    ])
    .then(files => {
      let f = files.reduce((acc, f) => [...acc, ...f], [])
      f.forEach(i => this.files.add(i))
      callback(null, files)
    })
    .catch(callback)
  }

/*
  readTree(callback) {
    this.retrieveAllBranches((err, branches) => {
      if(err) return callback(err)
      let count = branches.count
      let error, records = []
      if(!count) return callback(null, [])
      branches.forEach(branch => {
        let commitHash = branch.head
        this.getCommitAsync(commitHash)
          .then(commit => this.getTreeListAsync(commit.tree, false))
          .then(files => {
            if(error) return
            count --
            records.push(files)
            if(count === 0) return callback(null, files)
          })
          .catch(e => {
            error = e
            return callback(e)
          })
      })
    })
  }
*/

  /**
   * create a tweet
   * @param {Object} props 
   * @param {string} props.global - user global id
   * @param {string} props.comment - comment
   * @param {string} props.type - tweet type, optional
   * @param {string} props.id - sha256 for blob, commit, uuid for list, tag, branch, job. coexist with type.
   * @param {array} props.list - an array of {sha256, filename}, exist only when type is list.
   * @param {array} props.src - array of {sha256, filepath}, tmp path, optional
   * @return {Object} tweet object
   */
  async createTweetAsync(props) {
    let src = props.src  // src contains all files uploaded
    // filter out the files which are already in blobs
    let urls
    if (src) {
      urls = src.filter(s => {
        let target = this.ctx.blobs.retrieve(s.sha256)
        if (target) rimraf(s.filepath, () => { })  
        else return true
      })
      // urls = urls.map(u => {
      //   let dirname = path.dirname(u.filepath)
      //   let newpath = path.join(dirname, u.sha256)
      //   fs.renameSync(u.filepath, newpath)
      //   return newpath
      // })

      urls =  await Promise.all(urls.map(u => new Promise((resolve, reject) => {
        let dirname = path.dirname(u.filepath)
        let newpath = path.join(dirname, u.sha256)
        fs.rename(u.filepath, newpath, err => err ? reject(err) : resolve(newpath))
      })))
      if(urls && urls.length) await this.ctx.blobs.storeAsync(urls)
    }
    let tweet = {
      uuid: UUID.v4(),
      tweeter: props.global,
      comment: props.comment
    }
    if(props.parent || props.parent === 0) //FIXME: check range
      tweet.parent = props.parent

    if (props.type) {
      tweet.type = props.type
      if (props.type === 'list') {
        tweet.list = props.list 
        props.list.forEach(l => this.files.add(l.sha256))
      }
      else tweet.id = props.id
    }

    tweet.ctime = new Date().getTime()
    await this.DB.addAsync(tweet)

    // emit
    this.ctx.handleNewTweet({ boxUUID: this.doc.uuid, tweet })

    let stat = await fs.statAsync(this.DB.filePath)
    let mtime = stat.mtime.getTime()
    return { tweet, mtime }
  }

  /**
 * create system tweet
 * commentObj
 * {
 *   op: enum:'addUser', 'deleteUser', 'changeBoxName', 'createBox'
 *   value:[]
 * }
 * 
 */
  async createDefaultTweetAsync(global, commentObj) {
    
    let props = {
      global,
      comment: JSON.stringify(commentObj),
      type: 'boxmessage',
    }

    await this.createTweetAsync(props)
  }

  /**
   * get oppointed tweets
   * @param {Object} props 
   * @param {number} props.first - optional
   * @param {number} props.last - optional
   * @param {number} props.count - optional
   * @param {string} props.segments - optional
   * @return {array} a collection of tweet objects
   */
  async getTweetsAsync(props) {
    return await this.DB.getAsync(props)
  }

  /**
   * delete tweets
   * @param {array} indexArr - index array of tweets to be deleted
   */
  async deleteTweetsAsync(indexArr) {
    return await this.DB.deleteAsync(indexArr)
  }

  /**
   * create a job
   * @param {array} list - a list of file hash, length >= 2
   */
  async createJobAsync(list) {

  }

  /**
   * create a branch
   * @param {Object} props 
   * @param {string} props.name - branch name
   * @param {string} props.head - SHA256, a commit ref
   * @return {Object} branch object
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
    await saveObjectAsync(targetPath, this.ctx.ctx.getTmpDir(), branch)
    // this.branchMap.set(branch.uuid, branch)
    return branch
  }

  /**
   * retrieve a branch or commit
   * @param {string} branchID - branch uuid
   * @param {function} callback 
   * @return {Object} branch or commit object
   */
  retrieveBranch(branchID, callback) {
    let srcpath = path.join(this.dir, 'branches', branchID)
    fs.readFile(srcpath, (err, data) => {
      if (err) return callback(err)
      try {
        callback(null, JSON.parse(data.toString()))
      }
      catch (e) {
        callback(e)
      }
    })
  }

  /**
   * async edition of retrieveBranch
   * @param {string} branchID - branch uuid
   * @return {Object} branch or commit object
   */
  async retrieveBranchAsync(branchID) {
    return Promise.promisify(this.retrieveBranch).bind(this)(branchID)
  }

  /**
   * retrieve all
   * @param {string} type - branches or commits
   * @param {function} callback 
   * @return {array} collection of branches or commits
   */

  retrieveAllBranches(callback) {
    let target = path.join(this.dir, 'branches')
    fs.readdir(target, (err, entries) => {
      if (err) return callback(err)

      let count = entries.length
      if (!count) return callback(null, [])

      let result = []
      entries.forEach(entry => {
        this.retrieveBranch(entry, (err, obj) => {
          if (!err) result.push(obj)
          if (!--count) callback(null, result)
        })
      })
    })
  }

  /**
   * async edition of retrieveAll
   * @return {array} collection of branches or commits
   */
  async retrieveAllBranchesAsync() {
    return Promise.promisify(this.retrieveAllBranches).bind(this)()
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
    let branch = await this.retrieveBranchAsync(branchUUID)

    let { name, head } = props
    if (head) {
      let obj = await this.ctx.docStore.retrieveAsync(head)
      if (obj.parent !== branch.head) throw new E.EHEAD()
    }

    let updated = {
      uuid: branch.uuid,
      name: name || branch.name,
      head: head || branch.head
    }

    if (updated === branch) return branch
    await saveObjectAsync(target, this.ctx.ctx.getTmpDir(), updated)
    return updated
  }

  /**
   * delete a branch
   * @param {string} branchUUID - branch uuid
   */
  async deleteBranchAsync(branchUUID) {
    let target = path.join(this.dir, 'branches', branchUUID)
    await rimrafAsync(target)
    return
  }

  /*
  tree
  [
    ['blob', 'a,js', 'xxxxxx'],     // [type, name, hash]
  ]
   */
  // commit and tree are stored in docStore

  /**
  * estimate whether a root is exist in a box
  * @param {string} commitHash - commit hash
  * @return {boolean}
  */
  async commitExistInBox(commitHash) {
    let branches
    try {
      branches = await this.retrieveAllBranchesAsync()
    } catch (e) {
      if (e.code === 'ENOENT') return
    }

    let exist, _this = this

    // head is a commit hash
    let findCommit = async head => {
      if (commitHash === head) return true
      let commit = await _this.ctx.docStore.retrieveAsync(head)
      if (commit.parent) return await findCommit(commit.parent)
    }

    for (let i = 0; i < branches.length; i++) {
      exist = await findCommit(branches[i].head)
      if (exist) break
    }

    return exist
  }

  /**
   * estimate whether a tree is exist in a box
   * either in present or history edition
   * @param {string} treeHash - tree object hash
   * @return {boolean}
   */
  async treeExistInBox(treeHash) {
    let branches
    try {
      branches = await this.retrieveAllBranchesAsync()
    } catch (e) {
      if (e.code === 'ENOENT') return
    }

    let exist, _this = this

    const isSubTree = async parentTree => {
      let contents = await _this.ctx.docStore.retrieveAsync(parentTree)
      let index = contents.findIndex(i => i[2] === treeHash && i[0] === 'tree')
      if (index !== -1) return true
      else {
        let arr = contents.filter(i => i[0] === 'tree')
        for (let i = 0; i < arr.length; i++) {
          let existence = await isSubTree(arr[i][2])
          if (existence) return true
        }
      }
    }

    // head is a commit hash
    const findTree = async head => {
      // retrieve commit object
      // compare rootTreeHash with commit.tree
      // if not equal, look up in commit.tree
      // if not in commit.tree, find again with its parent
      let commit = await _this.ctx.docStore.retrieveAsync(head)
      if (commit.tree === treeHash) return true
      else {
        let subTree = await isSubTree(commit.tree)
        if (subTree) return true
        else {
          if (commit.parent) return await findTree(commit.parent)
        }
      }
    }

    for (let i = 0; i < branches.length; i++) {
      exist = await findTree(branches[i].head)
      if (exist) break
    }

    return exist
  }

  /**
   * list a tree object
   * @param {string} treeHash - tree object hash
   * @param {Boolean} recordDir - record dir if true
   * @return {array} a hash set of all trees and blobs in root(include itself)
   */
  async getTreeListAsync(treeHash, recordDir) {
    let hashSet = new Set()
    let _this = this
    // get contents in a tree object
    let getContent = async hash => {
      hashSet.add(hash)
      let obj = await _this.ctx.docStore.retrieveAsync(hash)
      await Promise.map(obj, async o => {
        if (o[0] === 'blob') hashSet.add(o[2])
        else if (o[0] === 'tree') await getContent(o[2])
        else throw Object.assign(new Error('invalid object type'), { status: 500 })
      })
    }

    let exist = await this.treeExistInBox(treeHash)
    if (!exist) throw Object.assign(new Error('given tree object is not exist in the box'), { status: 403 })

    await getContent(treeHash)
    return [...hashSet]
  }

  /**
   * get a commit object
   * @param {string} commitHash 
   * @return {Object} commit Object
   */
  async getCommitAsync(commitHash) {
    let exist = await this.commitExistInBox(commitHash)
    if (!exist) throw Object.assign(new Error('commit not exist in this box'), { status: 404 })
    else return await this.ctx.docStore.retrieveAsync(commitHash)
  }

/**
 * create a commit
 * @param {Object} props 
 * @param {string} props.root - required, hash string, root tree object
 * @param {string} props.committer - required, user global ID
 * @param {string} props.parent - optional, parent commit
 * @param {string} props.branch - optional, branch ID, commit on this branch
 * @param {array} props.toUpload - optional, hash string array, the hash of file to upload
 * @param {array} props.uploaded - optional, hash string array, the hash of file uploaded
 * @return {string} sha256 of commit object
 */
  async createCommitAsync(props) {
    // consistent match
    if (props.branch && props.parent) {
      let branch
      try {
        branch = await this.retrieveBranchAsync(props.branch)
      } catch (e) {
        throw e
      }
      if (branch.head !== props.parent) throw new E.EHEAD()
    }
    // if branch exist, parent must exist
    if (props.branch && !props.parent)
      throw Object.assign(new Error('parent must exist if branch exist'), { status: 400 })

    let exist = await this.treeExistInBox(props.root)
    if (!exist) {
      // in this case, uploaded in non-empty
      // toUpload should equal to uploaded
      if (!props.toUpload && !props.uploaded)
        throw Object.assign(new Error('toUpload and uploaded must exist'), { status: 400 })
      if (complementArray(props.toUpload, props.uploaded).length !== 0)
        throw Object.assign(new Error('something required is not uploaded'), { status: 400 })
      if (complementArray(props.uploaded, props.toUpload).length !== 0)
        throw Object.assign(new Error('something unnecessary is uploaded'), { status: 400 })

      let universe = [], trees = new Set(), blobs = new Set()
      if (props.parent) {
        let commit = await this.ctx.docStore.retrieveAsync(props.parent)
        universe = await this.getTreeListAsync(commit.tree, true)
      }
      // no intersectionn (universe and uploaded)
      if (universe.length !== 0 && complementArray(universe, props.uploaded).length !== universe.length)
        throw Object.assign(new Error('some file already exist uploaded again'), { status: 400 })

      // children first - a tree object is valid, children valid first
      let validation = (root) => {
        if (universe.includes(root)) return
        else if (props.uploaded.includes(root)) {
          let fpath = path.join(this.ctx.ctx.getTmpDir(), root)
          let data = fs.readFileSync(fpath)
          // console.log(fpath)
          // get tree object
          try {
            // console.log('read========',data.toString())
            data = JSON.parse(data.toString())
          } catch (e) {
            if (e instanceof SyntaxError)
              throw Object.assign(new Error('invalid tree object format'), { status: 500 })
            else throw e
          }

          data.forEach(item => {
            // validate format of content in tree object
            if (item[0] !== 'blob' && item[0] !== 'tree')
              throw Object.assign(new Error('invalid object type'), { status: 500 })
            if ((typeof item[1]) !== 'string')
              throw Object.assign(new Error('name should be string'), { status: 500 })
            if (!isSHA256(item[2]))
              throw Object.assign(new Error('invalid hash'), { status: 500 })

            if (item[0] === 'blob') {
              if (universe.includes(item[2])) return
              else if (props.uploaded.includes(item[2])) blobs.add(item[2])
              // no less
              else throw Object.assign(new Error('reference not found'), { status: 403 })
            }
            // for tree object, loop validation
            if (item[0] === 'tree') validation(item[2])
          })

          trees.add(root)
        }
        // no less
        else throw Object.assign(new Error('reference not found'), { status: 403 })
      }

      // validate format and value of root tree
      validation(props.root)
      // no more
      if (complementArray(props.uploaded, [...trees, ...blobs]).length !== 0)
        throw Object.assign(new Error('unnecessary file is uploaded'), { status: 500 })

      // store trees and blobs
      let blobpaths = [...blobs].map(i => path.join(this.ctx.ctx.getTmpDir(), i))
      let treepaths = [...trees].map(i => path.join(this.ctx.ctx.getTmpDir(), i))
      await this.ctx.blobs.storeAsync(blobpaths)
      await this.ctx.docStore.storeAsync(treepaths)
    }

    // create commit object
    let commit = {
      tree: props.root,
      committer: props.committer,
      ctime: new Date().getTime()
    }
    commit.parent = props.parent ? props.parent : null
    // store commit object
    let text = Stringify(commit)
    let hash = crypto.createHash('sha256')
    hash.update(text)
    let sha256 = hash.digest().toString('hex')

    let targetPath = path.join(this.ctx.docStore.dir, sha256)
    await saveObjectAsync(targetPath, this.ctx.ctx.getTmpDir(), commit)

    // update branch
    props.branch ? await this.updateBranchAsync(props.branch, { head: sha256 })
      : await this.createBranchAsync({ name: '', head: sha256 })

    // return commitObj just using for test
    return { sha256, commitObj: commit }
  }
}

module.exports = Box