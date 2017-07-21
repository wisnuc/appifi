const Promise = require('bluebird')
const path = require('path')
const Stringify = require('canonical-json')
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')
const crypto = require('crypto')
const deepEqual = require('deep-equal')
const lineByLineReader = require('line-by-line')

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
              manifest      // box doc
              records       // database
              blackList     // 
              [branches]    // 
              [commits]     //
              pull/push     //
*/

/**
 * twits DB
 */
class Records {

  /**
   * @param {string} filePath - twitsDB path 
   * @param {string} blackList - filepath of blackList
   */
  constructor(filePath, blackList) {
    this.filePath = filePath
    this.blackList = blackList
  }

  /**
   * save data to twits DB
   * @param {Object} obj - object to be stored to twits DB 
   * @param {number} start - position to start writing data
   * @private
   */
  save(obj, start) {
    let text = Stringify(obj)
    let writeStream = fs.createWriteStream(this.filePath, { flags: 'r+', start: start })
    writeStream.write(`\n${text}`)
    writeStream.close()
  }

  /**
   * add new data to twits DB
   * before adding, check the last record, if incorrect, delete it
   * @param {Object} obj - object to be stored
   */
  add(obj, callback) {
    let records = []
    let lr = new lineByLineReader(this.filePath, {skipEmptyLines: true})

    lr.on('line', line => records.push(line))

    lr.on('end', () => {
      let size = fs.readFileSync(this.filePath).length
      let last = records.pop()

      try {
        let lastObj = JSON.parse(last)
        obj.index = lastObj.index + 1
        this.save(obj, size)
        return callback(null)
      } catch(err) {
        if (err instanceof SyntaxError) {
          let start
          if (last) start = size - last.length - 1
          else start = size - 1

          if (start === -1) {
            obj.index = 0
            fs.truncate(this.filePath, err => {
              if (err) return callback(err)
              let text = Stringify(obj)
              let writeStream = fs.createWriteStream(this.filePath)
              writeStream.write(text)
              writeStream.close()
              return callback(null)
            })
          } else {
            let second = records.pop()
            obj.index = JSON.parse(second).index + 1
            fs.truncate(this.filePath, start, err => {
              if (err) return callback(err)
              this.save(obj, start)
              return callback(null)
            })
          }
        } else return callback(err)
      }     
    }) 
  }

  /**
   * async edition of add
   * @param {Object} obj - object to be stored
   */
  async addAsync(obj) {
    return Promise.promisify(this.add).bind(this)(obj)
  }

  /**
   * get twits
   * @param {Object} props
   * @param {number} props.first -optional
   * @param {number} props.last - optional
   * @param {number} props.count - optional
   * @param {string} props.segments - optional
   * @return {array} a collection of twit objects
   */
  get(props, callback) {
    let { first, last, count, segments } = props
    let records = []
    let lr = new lineByLineReader(this.filePath, {skipEmptyLines: true})

    // read all lines
    lr.on('line', line => records.push(line))

    // check the last line and repair twits DB if error exists
    lr.on('end', () => {
      // read blackList
      let blackList = fs.readFileSync(this.blackList).toString()
      blackList.length ? blackList = [...new Set(blackList.split(',').map(i => parseInt(i)))]
                       : blackList = []

      // repair wrong content and filter contents in blackList
      let size = fs.readFileSync(this.filePath).length
      let end = records.pop()

      try {
        JSON.parse(end)
        records.push(end)
      } catch(e) {
        if (e instanceof SyntaxError) {
          let start
          if (end) start = size - end.length - 1
          else start = size - 1

          start = (start === -1) ? 0 : start
          fs.truncate(this.filePath, start, err => {
            if (err) return callback(err)
          })
        } else return callback(e)
      }

      if (!first && !last && !count && !segments) {
        let result = records.map(r => JSON.parse(r))
                            .filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else if (!first && !last && count && !segments) {
        let result = records.silce(-count)
                            .map(r => JSON.parse(r))
                            .filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else if (first <= last && count && !segments) {
        let tail = records.slice(first - count, first)
        let head = records.slice(last + 1)
        let result = [...tail, ...head]
                    .map(r => JSON.parse(r))
                    .filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else if (!first && !last && !count && segments) {
        segments = segments.split('|').map(i => i.split(':'))
        let result = []
        segments.forEach(s => {
          s[1] !== ''
          ? result.push(...records.slice(Number(s[0]), Number(s[1]) + 1))
          : result.push(...records.slice(Number(s[0])))
        })

        result = result.map(r => JSON.parse(r)).filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else
        return callback(new E.EINVAL())
    })
  }

  /**
   * async edition of get
   * @param {Object} props 
   * @param {number} props.first -optional
   * @param {number} props.last - optional
   * @param {number} props.count - optional
   * @param {string} props.segments - optional
   * @return {array} each item in array is an twit object
   */
  async getAsync(props) {
    return Promise.promisify(this.get).bind(this)(props)
  }

  /**
   * delete twits
   * it's not delete the content in twitsDB, but add the index into blackList
   * @param {array} indexArr - index array of twits to be deleted
   */
  delete(indexArr, callback) {
    indexArr = [...new Set(indexArr)].toString()
    let size = fs.readFileSync(this.blackList).length
    let writeStream = fs.createWriteStream(this.blackList, { flags: 'r+', start: size })
    size ? writeStream.write(`,${indexArr}`) : writeStream.write(`${indexArr}`)
    writeStream.close()
    return callback(null)
  }

  /**
   * async detition of delete
   * @param {array} indexArr - index array of twits to be deleted
   */
  async deleteAsync(indexArr) {
    return Promise.promisify(this.delete).bind(this)(indexArr)
  }
}

/**

*/
class Box {

  /**
   * @param {string} dir - root path of box
   * @param {string} tmpDir - temporary directory path
   * @param {Object} doc - document of box
   * @param {Object} records - twitsDB
   */
  constructor(dir, tmpDir, doc, records) {
    this.dir = dir
    this.tmpDir = tmpDir
    this.doc = doc
    this.records = records
    // this.branchMap = new Map()
  }

  /**
   * create a twit
   * @param {Object} props 
   * @param {string} props.global - user global id
   * @param {string} props.comment - comment
   * @param {string} props.type - twit type, optional
   * @param {string} props.id - sha256 for blob, commit, uuid for list, tag, branch, job. coexist with type.
   * @param {array} props.list - an array of sha256, exist only when type is list.
   * @return {Object} twit object
   */
  async createTwitAsync(props) {
    let twit = {
      uuid: UUID.v4(),
      twitter: props.global,
      comment: props.comment
    }

    if (props.type) {
      twit.type = props.type
      twit.id = props.id
      if (props.type === 'list') twit.list = props.list
      // switch (props.type) {
      //   case 'blob':
      //     twit.sha256 = props.sha256
      //     break
      //   case 'list':
      //     twit.list = props.list
      //     twit.jobID = props.jobID
      //     break
      //   case 'commit':
      //     twit.hash = props.hash
      //     break
      //   case 'tag':
      //   case 'branch':
      //   case 'job':
      //     twit.id = props.id
      //     break
      //   default:
      //     break
      // }
    }

    twit.ctime = new Date().getTime()

    await this.records.addAsync(twit)
    return twit
  }

  /**
   * get oppointed twits
   * @param {Object} props 
   * @param {number} props.first - optional
   * @param {number} props.last - optional
   * @param {number} props.count - optional
   * @param {string} props.segments - optional
   * @return {array} a collection of twit objects
   */
  async getTwitsAsync(props) {
    return await this.records.getAsync(props)
  }

  /**
   * delete twits
   * @param {array} indexArr - index array of twits to be deleted
   */
  async deleteTwitAsync(indexArr) {
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

/**
 * 
 */
class BoxData {

  constructor() {

    this.initialized = false

    this.dir = undefined
    this.tmpDir = undefined
    this.repoDir = undefined
    this.map = undefined

    broadcast.on('FruitmixStart', froot => {
      let dir = path.join(froot, 'boxes')
      let tmpDir = path.join(froot, 'tmp') 
      let repoDir = path.join(froot, 'repo')

      this.init(dir, tmpDir, repoDir)
    })

    broadcast.on('FruitmixStop', () => this.deinit())
  }

  init(dir, tmpDir, repoDir) {

    mkdirp(dir, err => {

      if (err) {
        console.log(err) 
        broadcast.emit('BoxInitDone', err)
        return
      }

      this.initialized = true
      this.dir = dir
      this.tmpDir = tmpDir
      this.repoDir = repoDir
      this.map = new Map()

      broadcast.emit('BoxInitDone')
    })
  }

  deinit() {

    this.initialized = false
    this.dir = undefined
    this.tmpDir = undefined
    this.repoDir = undefined
    this.map = undefined

    process.nextTick(() => broadcast.emit('BoxDeinitDone'))
  }

/**
 * Create a box
 * @param {Object} props - props
 * @param {string} props.name - non-empty string, no conflict with existing box name
 * @param {string} props.owner - box owner, global id
 * @param {array} props.users - empty or global id array
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

    // FIXME: refactor saveObject to avoid rename twice
    await saveObjectAsync(path.join(tmpDir, 'manifest'), this.tmpDir, doc)
    await fs.renameAsync(tmpDir, path.join(this.dir, doc.uuid))
    let dbPath = path.join(this.dir, doc.uuid, 'records')
    let blPath = path.join(this.dir, doc.uuid, 'blackList')
    await fs.writeFileAsync(dbPath, '')
    await fs.writeFileAsync(blPath, '')
    let records = new Records(dbPath, blPath)
    let box = new Box(path.join(this.dir, doc.uuid), this.tmpDir, doc, records)

    this.map.set(doc.uuid, box)
    return box
  }

/**
 * update a box (rename, add or delete users)
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
 * @param {string} boxUUID - uuid of box to be deleted
 */
  async deleteBoxAsync(boxUUID) {
    await rimrafAsync(path.join(this.dir, boxUUID))
    this.map.delete(boxUUID)
    return
  }
}

module.exports = new BoxData()
