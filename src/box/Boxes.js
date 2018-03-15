const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const EventEmitter = require('events')
const assert = require('assert')

const debug = require('debug')('boxes:boxes')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')
const crypto = require('crypto')
const deepEqual = require('deep-equal')

const broadcast = require('../common/broadcast')
const { saveObjectAsync } = require('../lib/utils')
const Box = require('./Box')
const RecordsDB = require('./recordsDB')
const Blobs = require('./BlobStore')
const Docs = require('./docStore')


/**
 * Box notify
 * 1, Box_CreateBox
 * 2, Box_UpdateBox
 * 3, Box_DeleteBox
 * 4, Box_CreateTweet
 */

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
 * @param {Object} ctx - context
 * @param {string} dir - path to boxes module
 * @param {Object} doc - descriptor of box to be created
 * @return {Object} box
 */
const createBox = (ctx, dir, doc) => {
  let dbPath = path.join(dir, doc.uuid, 'recordsDB')
  let blPath = path.join(dir, doc.uuid, 'blackList')
  let DB = new RecordsDB(dbPath, blPath)

  return new Box(ctx, path.join(dir, doc.uuid), doc, DB)
}


class B extends EventEmitter {
  constructor (froot) {
    super()
    this.dir = path.join(froot, 'boxes')
    mkdirp.sync(this.dir)
    
    // all boxes memory cache
    this.boxes = new Map()

    // init state boxes
    this.initBoxes = new Set()

    // reading boxes
    this.readingBoxes = new Set()

    // readFail boxes
    this.readFailBoxes = new Set()
  }

  indexBox (box) {
    debug(`index box ${box.doc.name}`)
    this.boxes.set(box.doc.uuid, box)
  }

  unindexBox (box) {
    debug(`unindex box ${box.doc.name}`)
    this.boxes.delete(box.doc.uuid)
  }

  boxEnterInit (box) {
    debug(`box ${box.doc.name} enter init`)
    this.initBoxes.add(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxExitInit (box) {
    debug(`box ${box.doc.name} exit init`)
    this.initBoxes.delete(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxEnterReading (box) {
    debug(`box ${box.doc.name} enter reading`)
    this.readingBoxes.add(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxExitReading (box) {
    debug(`box ${box.doc.name} exit reading`)
    this.readingBoxes.delete(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxEnterFailed (box) {
    debug(`box ${box.doc.name} enter failed`)
    this.readFailBoxes.add(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  reqSchedBoxRead () {
    if (this.boxReadScheduled) return
    this.boxReadScheduled = true
    process.nextTick(() => this.scheduleBoxRead())
  }

  boxReadSettled () {
    return this.initBoxes.size === 0 &&
      this.readingBoxes.size === 0
  }

  scheduleBoxRead () {
    this.boxReadScheduled = false
    if (this.boxReadSettled()) {
      this.emit('BoxReadDone')
      console.log('Box load finished')
      return
    }
    while (this.initBoxes.size > 0 && this.readingBoxes.size < 6) {
      let uuid = this.initBoxes[Symbol.iterator]().next().value
      let box = this.boxes.get(uuid)
      assert(!!box)
      this.boxExitInit(box)
      this.boxEnterReading(box)
      box.read((err, files) => {
        this.boxExitReading(box)
        if(err) return this.boxEnterFailed(box)
        debug('box read finish ' + box.doc.name)
      })
    }
  }

  /**
   * emit some message when box or tweet update 
   */

  handleNewTweet({boxUUID, tweet}) {
    this.emit('Box_CreateTweet', { boxUUID, tweet })
  }

  handleNewBox(box) {
    this.emit('Box_CreateBox', Object.assign({}, box.doc))
  }

  handleUpdateBox(box) {
    this.emit('Box_UpdateBox', Object.assign({}, box.doc))
  }

  handleDeleteBox(boxUUID) {
    this.emit('Box_DeleteBox', boxUUID)
  }
}

/*
  fruitmix/blobs            // store blob
          /objects          // commits, trees and so on           
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
class Boxes extends B {
  constructor(ctx) {
    super(ctx.fruitmixPath)
    this.ctx = ctx
    this.docStore = new Docs(ctx.fruitmixPath)
    this.blobs = new Blobs(ctx)
    this.blobsInited = false
    this.boxesInited = false

    this.blobs.loadBlobs(e => {
      if(e) return console.log(e)
      debug('blob load success')
      this.blobsInited = true
    })
    this.loadBoxesSync()
  }

  /*
  loadBoxes (callback) {
    debug('Box start Load')
    fs.readdir(this.dir, (err, entries) => {
      if(err) return callback(err)
      let error, count = entries.length
      if (!count) return callback()
      entries.forEach(ent => {
        let target = path.join(this.dir, ent, 'manifest')
        fs.readFile(target, (err, data) => {
          if(error) return
          if(err) {
            error = err
            return callback(err)
          }
          let doc = JSON.parse(data.toString())
          let box = createBox(this, this.dir, doc)
          debug('load one box')
          this.boxEnterInit(box)
          if(--count === 0 ) return callback(null)
        })
      })
    })
  }
  */

  loadBoxesSync() {
    debug('Box start Load Sync')
    try {
      let entries = fs.readdirSync(this.dir)
      entries.forEach(ent => {
        let target = path.join(this.dir, ent, 'manifest')
        let data = fs.readFileSync(target)
        let doc = JSON.parse(data.toString())
        let box = createBox(this, this.dir, doc)
        debug('load one box')
        this.boxEnterInit(box)
      })
    }catch(e) {
      console.log(e)
    }
  }

  /**
   * get all boxes user can view
   * @param {string} global - user ID
   * @return {array} a list of box doc
   */
  getAllBoxes(guid) {
    let boxes = [...this.boxes.values()].filter(box => 
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
    return this.boxes.get(boxUUID)
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
    if(!props.users.includes(props.owner)) props.users.push(props.owner)
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

    let box = createBox(this, this.dir, doc)
    this.boxEnterInit(box)
    this.handleNewBox(box)
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
    await saveObjectAsync(path.join(this.dir, oldDoc.uuid, 'manifest'), this.ctx.getTmpDir(), newDoc)
    box.doc = newDoc
    this.handleUpdateBox(box)
    return newDoc
  }

  /**
   * delete a box
   * @param {string} boxUUID - uuid of box to be deleted
   */
  async deleteBoxAsync(boxUUID) {
    let box = this.boxes.get(boxUUID)
    if(!box) throw new Error('box not found')
    box.destory()
    await rimrafAsync(path.join(this.dir, boxUUID))
    this.handleDeleteBox(boxUUID)
    return
  }

  getBoxesSummary(callback) {
    let boxes = [...this.boxes.values()]
    let boxCount = boxes.length, error
    if(!boxCount) return callback(null)
    let boxSummary = []
    let finishHandle = (box) => {
      boxSummary.push(box)
      if(--boxCount) return
      callback(null, boxSummary)
    }
    let errorHandle = (err) => {
      if(error) return
      error = err
      return callback(err)
    }
    boxes.forEach(b => {
      b.DB.getLastTweet((err, last) => {
        if(err) return errorHandle(err)
        if(last) last.tweeter = last.tweeter.id
        finishHandle(Object.assign(b.doc, { tweet: last }))
      })
    })
  }

  getBoxSummary(boxUUID, callback) {
    let box = this.boxes.get(boxUUID)
    if(!box) return callback(new Error('box not found'))
    box.DB.getLastTweet((err, last) => {
      if(err) return callback(err)
      if(last) last.tweeter = last.tweeter.id      
      return callback(null, Object.assign(box.doc, { tweet: last }))
    })
  }
}

module.exports = Boxes