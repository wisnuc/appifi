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

const broadcast = require('../common/broadcast')
const { saveObjectAsync } = require('../lib/utils')
const E = require('../lib/error')
const blobStore = require('./blobStore')
const Records = require('./records')
const Box = require('./box')

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

/**
 * 
 * @param {string} dir - path to boxes module
 * @param {string} tmpDir - path to tmpDir
 * @param {Object} doc - descriptor of box to be created
 * @return {Object} box
 */
const createBox = (dir, tmpDir, doc) => {
  let dbPath = path.join(dir, doc.uuid, 'records')
  let blPath = path.join(dir, doc.uuid, 'blackList')
  let records = new Records(dbPath, blPath)
  return new Box(path.join(dir, doc.uuid), tmpDir, doc, records)
}

/*
  fruitmix/repo          // store blob 
          /boxes
            [uuid]/
              manifest      // box doc
              records       // database
              blackList     // indexes of tweets deleted
              [branches]/   //
                branchUUID  // information of the branch                      
*/

/**
 * 
 */
class BoxData {

  constructor(froot) {

    this.dir = path.join(froot, 'boxes')
    this.tmpDir = path.join(froot, 'tmp')
    this.map = new Map()

    mkdir(this.dir, err => {
      if (err) {
        console.log(err)
        broadcast.emit('BoxInitDone', err)
        return
      }

      broadcast.emit('BoxInitDone')
    })

    // this.initialized = false

    // this.dir = undefined
    // this.tmpDir = undefined
    // this.map = undefined

    // broadcast.on('FruitmixStart', froot => {
    //   let dir = path.join(froot, 'boxes')
    //   let tmpDir = path.join(froot, 'tmp') 

    //   this.init(dir, tmpDir)
    // })

    // broadcast.on('FruitmixStop', () => this.deinit())
  }

  // init(dir, tmpDir) {

  //   mkdirp(dir, err => {

  //     if (err) {
  //       console.log(err) 
  //       broadcast.emit('BoxInitDone', err)
  //       return
  //     }

  //     this.initialized = true
  //     this.dir = dir
  //     this.tmpDir = tmpDir
  //     this.map = new Map()

  //     broadcast.emit('BoxInitDone')
  //   })
  // }

  // deinit() {

  //   this.initialized = false
  //   this.dir = undefined
  //   this.tmpDir = undefined
  //   // this.repoDir = undefined
  //   this.map = undefined

  //   process.nextTick(() => broadcast.emit('BoxDeinitDone'))
  // }

  load() {
    fs.readdir(this.dir, (err, entries) => {
      entries.forEach(ent => {
        let target = path.join(this.dir, ent)
        fs.readFile(target, (err, data) => {
          let doc = JSON.parse(data.toString())
          let box = createBox(this.dir, this.tmpDir, doc)

          this.map.set(doc.uuid, box)
          broadcast.emit('boxCreated', doc)
        })
      })
    })
  }

  /**
   * get all boxes user can view
   * @param {string} global - user ID
   * @return {array} a list of box doc
   */
  getAllBoxes(global) {
    let boxes = [...this.map.values()].filter(box => 
                box.doc.owner === global ||
                box.doc.users.includes(global))

    return boxes.map(box => box.doc)
  }

  /**
   * get a box
   * @param {string} boxUUID - box uuid
   * @return {Object} box object
   */
  getBox(boxUUID) {
    return this.map.get(boxUUID)
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
    let time = new Date().getTime()
    let doc = {
      uuid: UUID.v4(),
      name: props.name,
      owner: props.owner,
      users: props.users,
      ctime: time,
      mtime: time
    }  

    // FIXME: refactor saveObject to avoid rename twice
    await saveObjectAsync(path.join(tmpDir, 'manifest'), this.tmpDir, doc)
    let dbPath = path.join(tmpDir, 'records')
    let blPath = path.join(tmpDir, 'blackList')
    await fs.writeFileAsync(dbPath, '')
    await fs.writeFileAsync(blPath, '')
    await fs.renameAsync(tmpDir, path.join(this.dir, doc.uuid))
    
    let box = createBox(this.dir, this.tmpDir, doc)

    this.map.set(doc.uuid, box)
    broadcast.emit('boxCreated', doc)
    return doc
  }

/**
 * update a box (rename, add or delete users)
 * @param {Object} props - properties to be updated
 * @param {Object} box - contents before update
 * @return {Object} newdoc
 */
  async updateBoxAsync(props, boxUUID) {
    let op
    let box = this.getBox(boxUUID)
    let oldDoc = box.doc
    let { name, users } = oldDoc

    if (props.name) name = props.name
    if (props.users) {
      let op = props.users.op
      switch (op) {
        case 'add': 
          users = addArray(users, props.users.value)
          break
        case 'delete':
          users = complement(users, props.users.value)
          break
        default:
          break
      }
    }

    let newDoc = {
      uuid: oldDoc.uuid,
      name,
      owner: oldDoc.owner,
      users,
      ctime: oldDoc.ctime
    }

    if (name === oldDoc.name && users === oldDoc.users) {
      if (!props.mtime) {
        return oldDoc
      }
      else newDoc.mtime = props.mtime
    } else newDoc.mtime = new Date().getTime()

    broadcast.emit('boxUpdating', oldDoc, newDoc)
    await saveObjectAsync(path.join(this.dir, oldDoc.uuid, 'manifest'), this.tmpDir, newDoc)
    box.doc = newDoc
    broadcast.emit('boxUpdated', oldDoc, newDoc)
    return newDoc
  }

/**
 * delete a box
 * @param {string} boxUUID - uuid of box to be deleted
 */
  async deleteBoxAsync(boxUUID) {
    broadcast.emit('boxDeleting', boxUUID)
    await rimrafAsync(path.join(this.dir, boxUUID))
    this.map.delete(boxUUID)
    broadcast.emit('boxDeleted', boxUUID)
    return
  }
}

module.exports = BoxData
