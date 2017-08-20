const Promise = require('bluebird')
const path = require('path')
const Stringify = require('canonical-json')
const fs = Promise.promisifyAll(require('fs'))
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const crypto = require('crypto')

const { saveObjectAsync } = require('../lib/utils')
const E = require('../lib/error')
const blobStore = require('./blobStore')

/**
  box
*/
class Box {

  /**
   * @param {string} dir - root path of box
   * @param {string} tmpDir - temporary directory path
   * @param {Object} doc - document of box
   * @param {Object} records - tweetsDB
   */
  constructor(dir, tmpDir, doc, records) {
    this.dir = dir
    this.tmpDir = tmpDir
    this.doc = doc
    this.records = records
    // this.branchMap = new Map()
  }

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
    // filter out the files which are already in repo
    let urls
    if (src) {
      urls = src.filter(s => {
        let target = blobStore.retrieve(s.sha256)
        try {
          let stats = fs.lstatSync(target)
          // remove the file in tmpdir which is already in repo
          rimraf(s.filepath, () => {})
          return
        } catch (e) {
          if (e.code !== 'ENOENT') throw e
          return true
        }
      })

      urls = urls.map(u => {
        let dirname = path.dirname(u.filepath)
        let newpath = path.join(dirname, u.sha256)
        fs.renameSync(u.filepath, newpath)
        return newpath
      })
      await blobStore.storeAsync(urls)
    }
    
    let tweet = {
      uuid: UUID.v4(),
      tweeter: props.global,
      comment: props.comment
    }

    if (props.type) {
      tweet.type = props.type
      if (props.type === 'list') tweet.list = props.list
      else tweet.id = props.id
    }

    tweet.ctime = new Date().getTime()

    await this.records.addAsync(tweet)
    let stat = await fs.statAsync(this.records.filePath)
    let mtime = stat.mtime.getTime()
    return {tweet, mtime}
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
    return await this.records.getAsync(props)
  }

  /**
   * delete tweets
   * @param {array} indexArr - index array of tweets to be deleted
   */
  async deleteTweetsAsync(indexArr) {
    return await this.records.deleteAsync(indexArr)
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
    await saveObjectAsync(targetPath, this.tmpDir, branch)
    // this.branchMap.set(branch.uuid, branch)
    return branch
  }

  /**
   * retrieve a branch or commit
   * @param {string} type - branches or commits
   * @param {string} id - branch uuid or commit hash
   * @param {function} callback 
   * @return {Object} branch or commit object
   */
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
   * @return {Object} branch or commit object
   */
  async retrieveAsync(type, id) {
    return Promise.promisify(this.retrieve).bind(this)(type, id)
  }

  /**
   * retrieve all
   * @param {string} type - branches or commits
   * @param {function} callback 
   * @return {array} collection of branches or commits
   */

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
   * async edition of retrieveAll
   * @param {string} type - branches or commits
   * @return {array} collection of branches or commits
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

  /**
   * delete a branch
   * @param {string} branchUUID - branch uuid
   */
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
   * @return {string} sha256 of commit object
   */
  async createCommitAsync(props) {
    let commit = {
      tree: props.tree,
      parent: props.parent,
      user: props.user,
      ctime: new Date().getTime()
      // comment: props.comment
    }

    let targetDir = path.join(this.dir, 'commits')
    await mkdirpAsync(targetDir)

    let text = Stringify(commit)
    let hash = crypto.createHash('sha256')
    hash.update(text)
    let sha256 = hash.digest().toString('hex')

    let targerPath = path.join(targetDir, sha256)
    await saveObjectAsync(targetPath, this.tmpDir, commit)

    return sha256
  }
}

module.exports = Box