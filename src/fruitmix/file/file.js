const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const E = require('../lib/error')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const log = require('winston')

const { 
  readXstatAsync,
  forceDriveXstatAsync 
} = require('./xstat')

class Node {

  constructor(ctx, xstat) {

    this.ctx = ctx
    this.children = []
    this.uuid = xstat.uuid
    this.name = xstat.name
    this.mtime = xstat.mtime
    this.dirty = true
    this.worker = null
    this.parent = null
  } 

  /**
  Add a child node
  */
  setChild(child) {
    this.children.push(child) 
  }

  /**
  Remove a child node
  */
  unsetChild(child) {
    let index = this.children.findIndex(c => c === child)
    if (index === -1) throw new Error('Node has no given child')
    this.children.splice(index, 1)
  }


  /**
  attach this dir to a parent dir
  @param {(null|Dir)} parent - parent node to attach, or null
  @throws When node is already attached, or, parent is not a DirectoryNode
  */
  attach(parent) {

    if (this.parent !== null) 
      throw new Error('node is already attached') 

    if (parent === null) {
    }
    else {
      if (!(parent instanceof Node)) 
        throw new Error('parent is not a node')
      this.parent = parent
      parent.setChild(this)
    }
    this.ctx.nodeAttached(this)
  } 

  /**
  return node array starting from root
  @throws When root node is not a DriveNode
  */
  nodepath() {

    let q = []
    for (let node = this; node !== null; node = node.parent)
      q.unshift(node)

    return q
  }   

  /**
  return absolute path 
  @throws When root node is not a DriveNode
  */
  abspath() { 
    return path.join(this.ctx.dir, ...this.nodepath().map(n => n.name))
  }
}

class File extends EventEmitter {

  constructor() {
    super()
  }

  async initAsync(drivesDir, tmpDir) {

    this.dir = drivesDir
    this.roots = []
    this.uuidMap = new Map()
  }

  findNodeByUUID(uuid) {
    return this.uuidMap.get(uuid)   
  }

  async createDriveAsync (drive) {

    let driveUUID = drive.uuid
    let dir = path.join(this.dir, driveUUID)   
    await mkdirpAsync(dir)
    let xstat = await forceDriveXstatAsync(dir, driveUUID)
    let node = new Node(this, xstat)
    node.attach(null)
    this.roots.push(node)
  }    

  deleteDrive(driveUUID) {
    
  } 

  nodeAttached(node) {
    this.uuidMap.set(node.uuid, node)
  } 

  nodeDetaching(node) {
    this.uuidMap.delete(node.uuid)
  } 

  async mkdirAsync(parent, name) {

    let dirPath = path.join(parent.abspath(), name)
    await fs.mkdirAsync(dirPath)
    let xstat = await readXstatAsync(dirPath)
    let node = new Node(this, xstat)
    node.attach(parent)
    return node
  }

  async renameDirAsync(node, name) {

    let oldPath = node.abspath()
    let newPath = path.join(path.dirname(oldPath), name)
    await fs.renameAsync(oldPath, newPath)
    let xstat = await readXstatAsync(newPath)

    // TODO node.uuid === xstat.uuid ?
   
    node.name = xstat.name
    return node
  }
}

module.exports = new File()

