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

const Node = require('./node')
const File = requrie('./file')
const Directory = require('./directory')

const { readXstatAsync, forceDriveXstatAsync } = require('../file/xstat')

class Forest extends EventEmitter {

  constructor() {
    super()
  }

  async initAsync(drivesDir, tmpDir) {

    this.dir = drivesDir
    this.roots = []
    this.uuidMap = new Map()
    this.hashMap = new Map()
  }

  findDirectoryByUUID(uuid) {
    return this.uuidMap.get(uuid)   
  }

  /**
  given a dir path, returns xstat lists.
  */
  async listDirAsync(dirPath) {

    let entries = await fs.readdirAsync(dirPath) 

    return await Promise
      .map(entries, entry => new Promise((resolve, reject) => {
        readXstatAsync(path.join(dirPath, entry))
          .then(x => resolve(x))
          .catch(e => resolve(null))
      }))
      .filter(x => !!x)
  }

  /**
  */
  async scanNewDirAsync(dir) {
    
    let xstats = await this.listDirAsync(dir.abspath())
    xstats.filter(x => x.type === 'directory')
      .forEach(x => {
        let child = new Directory(this, x, false)
        child.attach(dir)
      })

    await Promise.map(dir.children, child => this.scanNewDirAsync(child))
  }

  async createDriveAsync(drive, scanDone) {

    let driveUUID = drive.uuid
    let dirPath = path.join(this.dir, driveUUID)   
    await mkdirpAsync(dirPath)
    let xstat = await forceDriveXstatAsync(dirPath, driveUUID)
    let dir = new Directory(this, xstat, false)
    dir.attach(null)
    this.roots.push(dir)
    this.scanNewDirAsync(dir)
      .then(() => scanDone && scanDone())
      .catch(e => console.log(e))
  }    

  deleteDrive(driveUUID) {
     
  } 

  nodeAttached(node) {
    this.uuidMap.set(node.uuid, node)
  } 

  nodeDetaching(node) {
    this.uuidMap.delete(node.uuid)
  } 

  mediaFound(file) {

    if (this.hashMap.has(file.hash)) 
      this.hashMap.get(file.hash).add(file)
    else 
      this.hashMap.set(file.hash, new Set([file]))
  }

  mediaLost(file) {
    this.hashMap.get(file.hash).delete(file)
  }

  async mkdirAsync(parent, name) {

    if (!parent instanceof Directory) throw new Error('mkdirAsync: parent is not a dir node')

    let dirPath = path.join(parent.abspath(), name)
    await fs.mkdirAsync(dirPath)
    let xstat = await readXstatAsync(dirPath)
    let node = new Directory(this, xstat)
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

module.exports = new Forest()

