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

const addArray = (a, b) => {
  let c = Array.from(new Set([...a, ...b]))
  return deepEqual(a, c) ? a :c
}

const complement = (a, b) => 
  a.reduce((acc, c) => 
    b.includes(c) ? acc : [...acc, c], [])

/*
  fruitmix/repo          // store blob 
          /boxes
            [uuid]/
              manifest  // 
              commits   // database
*/


class Box {

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
    let box = {
      uuid: UUID.v4(),
      name: props.name,
      owner: props.owner,
      users: props.users,
    }  

    // FIXME refactor saveObject to avoid rename twice
    await saveObjectAsync(path.join(tmpDir, 'manifest'), this.tmpDir, box)
    await fs.renameAsync(tmpDir, path.join(this.dir, box.uuid))

    this.map.set(box.uuid, box)
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
    let { name, users } = box

    op = props.find(op => (op.path === 'name' && op.operation === 'update'))
    if(op) name = op.value

    op = props.find(op => (op.path === 'users' && op.operation === 'add'))
    if(op) users = addArray(users, op.value)

    op = props.find(op => (op.path === 'users' && op.operation === 'delete'))
    if(op) users = complement(users, op.value)

    if(name === box.name && users === box.users) return box

    let newBox = {
      uuid: box.uuid,
      name,
      owner: box.owner,
      users
    }

    await saveObjectAsync(path.join(this.dir, box.uuid, 'manifest'), this.tmpDir, newBox)
    
    this.map.set(box.uuid, newBox)
    return newBox
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

module.exports = new Box()
