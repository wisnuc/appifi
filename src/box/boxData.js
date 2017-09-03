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
// const E = require('../lib/error')
// const blobStore = require('./blobStore')
const RecordsDB = require('./recordsDB')
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
const createBox = (ctx, dir, doc) => {
  let dbPath = path.join(dir, doc.uuid, 'recordsDB')
  let blPath = path.join(dir, doc.uuid, 'blackList')
  let DB = new RecordsDB(dbPath, blPath)

  return new Box(ctx, path.join(dir, doc.uuid), doc, DB)
}

/*
  fruitmix/blobs          // store blob 
          /boxes
            [uuid]/
              manifest      // box doc
              recordsDB     // database
              blackList     // indexes of tweets deleted
              [branches]/   //
                branchUUID  // information of the branch                      
*/

/**
 * 
 */
class BoxData {
  constructor(ctx) {
    this.ctx = ctx
    this.dir = path.join(this.ctx.fruitmixPath, 'boxes')
    this.map = new Map()

    mkdirp(this.dir, err => {
      if (err) {
        console.log(err)
        broadcast.emit('BoxInitDone', err)
        return
      }

      broadcast.emit('BoxInitDone')
    })
  }

  load() {
    fs.readdir(this.dir, (err, entries) => {
      entries.forEach(ent => {
        let target = path.join(this.dir, ent)
        fs.readFile(target, (err, data) => {
          let doc = JSON.parse(data.toString())
          let box = createBox(this.dir, this.ctx.getTmpDir(), doc)

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
  getAllBoxes(guid) {
    let boxes = [...this.map.values()].filter(box => 
                box.doc.owner === guid ||
                box.doc.users.includes(guid))
                
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

    let tmp = await fs.mkdtempAsync(path.join(this.ctx.getTmpDir(), 'tmp'))
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
    await saveObjectAsync(path.join(tmp, 'manifest'), this.ctx.getTmpDir(), doc)
    let dbPath = path.join(tmp, 'recordsDB')
    let blPath = path.join(tmp, 'blackList')
    await fs.writeFileAsync(dbPath, '')
    await fs.writeFileAsync(blPath, '')
    await fs.renameAsync(tmp, path.join(this.dir, doc.uuid))

    let box = createBox(this.ctx, this.dir, doc)

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
    await saveObjectAsync(path.join(this.dir, oldDoc.uuid, 'manifest'), this.ctx.getTmpDir(), newDoc)
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
