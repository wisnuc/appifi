const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const deepEqual = require('deep-equal')

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

  }

  async initAsync(boxesDir, tmpDir) {

    this.dir = boxesDir
    this.tmpDir = tmpDir
    this.map = new Map()

    await mkdirpAsync(this.dir)
  }

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
}

module.exports = new Box()
